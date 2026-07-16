import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Client as PgClient, type QueryResultRow } from 'pg';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, isAbsolute, join } from 'path';
import { DataSource, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Usuario } from '../entities/usuario.entity';
import { Projeto } from '../entities/projeto.entity';
import { Documento } from '../entities/documento.entity';
import { Evento } from '../entities/evento.entity';
import { Designacao } from '../entities/designacao.entity';
import { CronogramaItem } from '../entities/cronograma-item.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { Modificacao } from '../entities/modificacao.entity';
import { AtividadeCronograma } from '../entities/atividade-cronograma.entity';
import { SlotCronograma } from '../entities/slot-cronograma.entity';
import { CronogramaConfig } from '../entities/cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from '../entities/cronograma-periodo-bloqueado.entity';
import { LevantamentoResposta } from '../entities/levantamento-resposta.entity';
import { DocConteudo } from '../entities/doc-conteudo.entity';
import { Protocolo } from '../entities/protocolo.entity';
import { MatrizCompetencia } from '../entities/matriz-competencia.entity';
import { MatrizTecnico } from '../entities/matriz-tecnico.entity';
import { ConsultaBD } from '../entities/consulta-bd.entity';
import { ModeloEmail } from '../entities/modelo-email.entity';
import { ChecklistModelo } from '../entities/checklist-modelo.entity';
import { IndiceTopico } from '../entities/indice-topico.entity';
import { ModeloDocumento } from '../entities/modelo-documento.entity';
import { ModeloDocumentoVersao } from '../entities/modelo-documento-versao.entity';
import { ModeloDocumentoCampo } from '../entities/modelo-documento-campo.entity';

/** Migração de dados do Postgres do Painel Flask (produção) para o schema novo (NestJS).
 * Ver docs/migracao/03-documento-conversao.md §9/§13 para o contexto completo. Regras
 * inegociáveis desta migração:
 *
 * 1. NUNCA escreve na origem — só `SELECT`, via uma conexão `pg` própria e separada da
 *    do NestJS (nunca reaproveita `AppDataSource`/`MIGRACAO_DB_URL` para ler a origem).
 * 2. Lê a origem de `MIGRACAO_ORIGEM_DB_URL` — NUNCA de `PAINEL_DB_URL` (mesmo valor,
 *    nome deliberadamente diferente: reaproveitar o nome `PAINEL_*` aqui já causou uma
 *    conexão acidental ao Postgres de produção durante o desenvolvimento desta migração —
 *    ver docs/migracao/03-documento-conversao.md §6 item 4. Copie o valor de
 *    `PAINEL_DB_URL` para `MIGRACAO_ORIGEM_DB_URL` explicitamente antes de rodar.
 * 3. Roda em modo leitura (relatório, nada é escrito no destino) por padrão — só grava
 *    com a flag `--aplicar`.
 * 4. Idempotente: preserva o `id` original em todas as tabelas por-projeto (upsert via
 *    `repository.save()`, que faz UPDATE quando o id já existe) — seguro rodar de novo
 *    após uma falha no meio do caminho.
 * 5. Nunca migra `senha_hash` (bcrypt no destino, scrypt/pbkdf2 do werkzeug na origem —
 *    hashes incompatíveis, impossível converter). Cada usuário migrado recebe uma senha
 *    temporária aleatória nova; a lista final vai só para um arquivo local
 *    (`dados/migracao-senhas-temporarias.csv`), nunca para o console/log.
 *
 * Uso:
 *   MIGRACAO_ORIGEM_DB_URL=postgresql://... npm run migrar:legado            # dry-run
 *   MIGRACAO_ORIGEM_DB_URL=postgresql://... npm run migrar:legado -- --aplicar
 *   (opcional) MIGRACAO_ORIGEM_DADOS_DIR=<pasta gravável do Flask> — usada como fallback
 *   para copiar arquivos (documentos gerados, vídeos de protocolo, modelos enviados)
 *   quando o caminho absoluto gravado na origem não existir neste host.
 */

const aplicar = process.argv.includes('--aplicar');
const continuar = process.argv.includes('--continuar');

interface Relatorio {
  tabela: string;
  origem: number;
  migrados: number;
  observacao?: string;
}

const relatorios: Relatorio[] = [];

function log(msg: string): void {
  console.log(msg);
}

async function origemConectar(): Promise<PgClient> {
  const url = process.env.MIGRACAO_ORIGEM_DB_URL;
  if (!url) {
    throw new Error(
      'MIGRACAO_ORIGEM_DB_URL não definida. Defina explicitamente com o valor de ' +
        'PAINEL_DB_URL (nunca leia PAINEL_DB_URL diretamente aqui — ver o cabeçalho deste arquivo).',
    );
  }
  const client = new PgClient({ connectionString: url });
  await client.connect();
  return client;
}

async function origemQuery<T extends QueryResultRow>(
  client: PgClient,
  sql: string,
): Promise<T[]> {
  const r = await client.query<T>(sql);
  return r.rows;
}

/** Lê um valor de coluna de texto de uma linha `Record<string, unknown>` (driver `pg` não
 * tipa o retorno) sem cair no aviso de "stringificação insegura" do ESLint — a coluna é
 * sempre TEXT/VARCHAR no Postgres de origem, então o cast é seguro por construção. */
function txt(v: unknown): string {
  return (v as string) ?? '';
}

/** Ajusta a sequence do `id` da tabela para depois do maior id inserido — sem isso, o
 * próximo INSERT sem id explícito (uso normal da aplicação) colidiria com um id migrado. */
async function ajustarSequence(ds: DataSource, tabela: string): Promise<void> {
  if (ds.options.type !== 'postgres') return; // sqlite (testes locais) não usa sequence
  await ds.query(
    `SELECT setval(pg_get_serial_sequence('"${tabela}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tabela}"), 1), true)`,
  );
}

/** Grava uma linha preservando o `id` original da origem via SQL bruto (INSERT ... ON
 * CONFLICT DO UPDATE). NÃO existe alternativa via `repository.save()`/`create()` aqui: o
 * TypeORM, para colunas `@PrimaryGeneratedColumn()`, SEMPRE omite a coluna `id` da lista de
 * colunas do INSERT — mesmo com o valor setado explicitamente no objeto — e deixa o Postgres
 * gerar um id novo por sequence. Isso ficou invisível nos testes com dados sintéticos (ids
 * baixos como 1/2, que por coincidência são os mesmos que a sequence geraria de qualquer
 * forma) e só apareceu ao migrar um projeto real com id 174: cada rodada criava uma linha
 * NOVA com id auto-gerado (nunca 174), deixando toda tabela filha (designacoes, eventos,
 * cronograma_atividades etc., que gravam o projeto_id da ORIGEM) órfã — sem o registro do
 * Postgres, não haveria erro nenhum, só corrupção silenciosa. `dados` deve incluir `id` e
 * usa nomes de PROPRIEDADE da entidade (camelCase) — a resolução para nome de coluna do
 * banco usa os metadados do próprio TypeORM, então também funciona para colunas com `name`
 * customizado (ex.: `projetoId` -> `projeto_id`). */
async function upsertComId<Entidade extends { id: number }>(
  ds: DataSource,
  entidade: new () => Entidade,
  dados: Record<string, unknown>,
): Promise<void> {
  const metadata = ds.getMetadata(entidade);
  const colunas = Object.keys(dados).map((propriedade) => {
    const coluna = metadata.findColumnWithPropertyName(propriedade);
    if (!coluna) {
      throw new Error(
        `upsertComId: propriedade "${propriedade}" não existe em ${metadata.name}`,
      );
    }
    return { db: coluna.databaseName, valor: dados[propriedade] };
  });
  const nomesColunas = colunas.map((c) => `"${c.db}"`).join(', ');
  const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
  const atualizacoes = colunas
    .filter((c) => c.db !== 'id')
    .map((c) => `"${c.db}" = EXCLUDED."${c.db}"`)
    .join(', ');
  await ds.query(
    `INSERT INTO "${metadata.tableName}" (${nomesColunas}) VALUES (${placeholders})
     ON CONFLICT ("id") DO UPDATE SET ${atualizacoes}`,
    colunas.map((c) => c.valor),
  );
}

/** Copia o arquivo de `caminhoOrigem` para `destinoDir/nomeDestino`, tentando primeiro o
 * caminho absoluto gravado na origem e, se não existir neste host, `MIGRACAO_ORIGEM_DADOS_DIR`
 * + nome do arquivo como fallback. Devolve o caminho novo (para gravar no registro
 * migrado) ou `null` se o arquivo não foi encontrado em nenhum dos dois lugares — nesse
 * caso a LINHA ainda é migrada (metadados preservados), só o arquivo fica indisponível
 * para download até ser copiado manualmente. */
function copiarArquivoSePossivel(
  caminhoOrigem: string,
  destinoDir: string,
  nomeSugerido?: string,
): string | null {
  if (!caminhoOrigem) return null;
  const candidatos = [caminhoOrigem];
  const dadosDir = process.env.MIGRACAO_ORIGEM_DADOS_DIR;
  if (dadosDir) candidatos.push(join(dadosDir, basename(caminhoOrigem)));
  const encontrado = candidatos.find((c) => isAbsolute(c) && existsSync(c));
  if (!encontrado) return null;
  mkdirSync(destinoDir, { recursive: true });
  const nome = nomeSugerido ?? basename(encontrado);
  const destino = join(destinoDir, nome);
  copyFileSync(encontrado, destino);
  return destino;
}

// --- Usuários (com reset de senha) -----------------------------------------------

interface SenhaTemp {
  login: string;
  nome: string;
  email: string;
  senha: string;
}

async function migrarUsuarios(
  origem: PgClient,
  ds: DataSource,
): Promise<SenhaTemp[]> {
  interface Row {
    id: number;
    login: string;
    nome: string;
    email: string;
    perfil: string;
    codigo_sicla: string;
    ativo: number | boolean;
    criado_em: Date;
  }
  const todas = await origemQuery<Row>(
    origem,
    'SELECT id, login, nome, email, perfil, codigo_sicla, ativo, criado_em FROM usuarios ORDER BY id',
  );

  // A origem NUNCA teve `login` único (schema antigo não declara essa constraint) — o
  // destino sim (`Usuario.login` é @Index({unique:true})). Quando duas linhas da origem
  // colidem no mesmo login, mantém só a "mais válida": ativa antes de inativa; entre
  // ativas (não deveria acontecer, mas por segurança) ou entre inativas, a mais recente
  // (`criado_em` maior). As demais são puladas — reportadas explicitamente, nunca
  // silenciosamente descartadas.
  const porLogin = new Map<string, Row[]>();
  for (const r of todas) {
    const chave = (r.login || '').trim().toLowerCase();
    const grupo = porLogin.get(chave) ?? [];
    grupo.push(r);
    porLogin.set(chave, grupo);
  }
  const linhas: Row[] = [];
  const duplicadasIgnoradas: string[] = [];
  for (const [chave, grupo] of porLogin) {
    if (grupo.length === 1 || !chave) {
      linhas.push(...grupo);
      continue;
    }
    const ordenado = [...grupo].sort((a, b) => {
      const ativoA = a.ativo ? 1 : 0;
      const ativoB = b.ativo ? 1 : 0;
      if (ativoA !== ativoB) return ativoB - ativoA; // ativo primeiro
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(); // mais recente primeiro
    });
    linhas.push(ordenado[0]);
    for (const ignorada of ordenado.slice(1)) {
      duplicadasIgnoradas.push(
        `login "${ignorada.login}" (id ${ignorada.id} da origem, ativo=${Boolean(ignorada.ativo)}) — mantido só o id ${ordenado[0].id}`,
      );
    }
  }

  const senhas: SenhaTemp[] = [];
  if (!aplicar) {
    relatorios.push({
      tabela: 'usuarios',
      origem: todas.length,
      migrados: 0,
      observacao:
        duplicadasIgnoradas.length > 0
          ? `dry-run — ${duplicadasIgnoradas.length} login(s) duplicado(s) na origem seriam ignorados: ${duplicadasIgnoradas.join('; ')}`
          : 'dry-run',
    });
    return senhas;
  }
  for (const r of linhas) {
    const senha = randomBytes(9).toString('base64url');
    const senhaHash = await bcrypt.hash(senha, 12);
    await upsertComId(ds, Usuario, {
      id: r.id,
      login: r.login || '',
      nome: r.nome || '',
      email: r.email || '',
      senhaHash,
      perfil: (r.perfil as Usuario['perfil']) || 'Consultor',
      codigoSicla: r.codigo_sicla || '',
      ativo: Boolean(r.ativo),
    });
    senhas.push({ login: r.login, nome: r.nome, email: r.email, senha });
  }
  await ajustarSequence(ds, 'usuarios');
  relatorios.push({
    tabela: 'usuarios',
    origem: todas.length,
    migrados: senhas.length,
    observacao:
      duplicadasIgnoradas.length > 0
        ? `${duplicadasIgnoradas.length} login(s) duplicado(s) na origem, ignorados: ${duplicadasIgnoradas.join('; ')}`
        : undefined,
  });
  return senhas;
}

// --- Genérico: tabela 1:1, id preservado, sem transformação de arquivo -----------

interface ColunaMapa {
  origem: string;
  destino: string;
  /** Transforma o valor da origem antes de gravar (ex.: 0/1 -> boolean). */
  converter?: (v: unknown) => unknown;
  /** Marca colunas de data/timestamp — nunca recebem o default de string vazia quando
   * vêm nulas da origem (ausência de data é legítima, não é o mesmo caso de texto). */
  ehData?: boolean;
}

async function migrarTabelaSimples<Entidade extends { id: number }>(
  origem: PgClient,
  ds: DataSource,
  opts: {
    tabelaOrigem: string;
    entidade: new () => Entidade;
    colunas: ColunaMapa[];
    ordenarPor?: string;
  },
): Promise<void> {
  const ordem = opts.ordenarPor ?? 'id';
  const colunasSql = ['id', ...opts.colunas.map((c) => c.origem)].join(', ');
  const linhas = await origemQuery<Record<string, unknown>>(
    origem,
    `SELECT ${colunasSql} FROM ${opts.tabelaOrigem} ORDER BY ${ordem}`,
  );
  if (!aplicar) {
    relatorios.push({
      tabela: opts.tabelaOrigem,
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  for (const linha of linhas) {
    const dados: Record<string, unknown> = { id: linha.id };
    for (const c of opts.colunas) {
      const bruto = linha[c.origem];
      if (c.converter) {
        dados[c.destino] = c.converter(bruto);
      } else if (c.ehData) {
        dados[c.destino] = bruto;
      } else {
        // O schema antigo permitia NULL em colunas de texto que o schema novo declara
        // NOT NULL com default '' — achado real em produção (ex.: designacoes.analista).
        dados[c.destino] = bruto ?? '';
      }
    }
    await upsertComId(ds, opts.entidade, dados);
  }
  await ajustarSequence(ds, opts.tabelaOrigem);
  relatorios.push({
    tabela: opts.tabelaOrigem,
    origem: linhas.length,
    migrados: linhas.length,
  });
}

// --- Documentos (com cópia best-effort do arquivo) --------------------------------

async function migrarDocumentos(
  origem: PgClient,
  ds: DataSource,
): Promise<void> {
  interface Row {
    id: number;
    projeto_id: number;
    tipo: string;
    arquivo: string;
    caminho: string;
    origem: string;
    criado_em: Date;
  }
  const linhas = await origemQuery<Row>(
    origem,
    'SELECT id, projeto_id, tipo, arquivo, caminho, origem, criado_em FROM documentos ORDER BY id',
  );
  if (!aplicar) {
    relatorios.push({
      tabela: 'documentos',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  const destinoDir = join(process.cwd(), 'dados', 'documentos_gerados');
  let semArquivo = 0;
  for (const r of linhas) {
    const novoCaminho = copiarArquivoSePossivel(
      r.caminho,
      destinoDir,
      `${r.projeto_id}_legado_${r.arquivo}`,
    );
    if (!novoCaminho) semArquivo++;
    await upsertComId(ds, Documento, {
      id: r.id,
      projetoId: r.projeto_id,
      tipo: r.tipo || '',
      arquivo: r.arquivo || '',
      caminho: novoCaminho ?? r.caminho ?? '',
      origem: (r.origem as Documento['origem']) || 'gerado',
      criadoEm: r.criado_em,
    });
  }
  await ajustarSequence(ds, 'documentos');
  relatorios.push({
    tabela: 'documentos',
    origem: linhas.length,
    migrados: linhas.length,
    observacao: semArquivo
      ? `${semArquivo} sem o arquivo físico encontrado (metadados migrados)`
      : undefined,
  });
}

// --- Protocolos (com cópia best-effort do vídeo) ----------------------------------

async function migrarProtocolos(
  origem: PgClient,
  ds: DataSource,
): Promise<void> {
  const linhas = await origemQuery<Record<string, unknown>>(
    origem,
    `SELECT id, titulo, modulo, menu, assunto, resumo, objetivo, quando_utilizar, pre_requisitos,
            passo_a_passo, configuracoes, dependencias, regras_negocio, pontos_atencao, exemplos,
            assuntos_removidos, pendencias, video_nome, video_caminho, video_origem, video_hash,
            duracao_seg, transcricao, texto_ia, status, log_erro, historico, responsavel,
            aprovador, criado_em, processado_em, aprovado_em
       FROM protocolos ORDER BY id`,
  );
  if (!aplicar) {
    relatorios.push({
      tabela: 'protocolos',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  const destinoDir = join(process.cwd(), 'dados', 'protocolos_videos');
  let semVideo = 0;
  for (const r of linhas) {
    const caminhoOrigem = (r.video_caminho as string) ?? '';
    const novoCaminho = copiarArquivoSePossivel(
      caminhoOrigem,
      destinoDir,
      `${String(r.id)}_${String(r.video_nome)}`,
    );
    if (!novoCaminho) semVideo++;
    await upsertComId(ds, Protocolo, {
      id: r.id,
      titulo: (r.titulo as string) ?? '',
      modulo: (r.modulo as string) ?? '',
      menu: (r.menu as string) ?? '',
      assunto: (r.assunto as string) ?? '',
      resumo: (r.resumo as string) ?? '',
      objetivo: (r.objetivo as string) ?? '',
      quandoUtilizar: (r.quando_utilizar as string) ?? '',
      preRequisitos: (r.pre_requisitos as string) ?? '',
      passoAPasso: (r.passo_a_passo as string) ?? '',
      configuracoes: (r.configuracoes as string) ?? '',
      dependencias: (r.dependencias as string) ?? '',
      regrasNegocio: (r.regras_negocio as string) ?? '',
      pontosAtencao: (r.pontos_atencao as string) ?? '',
      exemplos: (r.exemplos as string) ?? '',
      assuntosRemovidos: (r.assuntos_removidos as string) ?? '',
      pendencias: (r.pendencias as string) ?? '',
      videoNome: (r.video_nome as string) ?? '',
      videoCaminho: novoCaminho ?? caminhoOrigem,
      videoOrigem: (r.video_origem as Protocolo['videoOrigem']) || 'sharepoint',
      videoHash: (r.video_hash as string) ?? '',
      duracaoSeg: (r.duracao_seg as number) ?? 0,
      transcricao: (r.transcricao as string) ?? '',
      textoIa: (r.texto_ia as string) ?? '',
      status: (r.status as Protocolo['status']) || 'Pendente',
      logErro: (r.log_erro as string) ?? '',
      historico: (r.historico as string) ?? '',
      responsavel: (r.responsavel as string) ?? '',
      aprovador: (r.aprovador as string) ?? '',
      criadoEm: r.criado_em,
      processadoEm: r.processado_em,
      aprovadoEm: r.aprovado_em,
    });
  }
  await ajustarSequence(ds, 'protocolos');
  relatorios.push({
    tabela: 'protocolos',
    origem: linhas.length,
    migrados: linhas.length,
    observacao: semVideo
      ? `${semVideo} sem o vídeo físico encontrado (metadados/transcrição migrados)`
      : undefined,
  });
}

// --- Catálogos "upsert por slug" (o destino já pode ter os padrões semeados no boot) ---

async function upsertPorSlug<Entidade extends { id: number; slug: string }>(
  origem: PgClient,
  ds: DataSource,
  opts: {
    tabelaOrigem: string;
    entidade: new () => Entidade;
    colunasSql: string;
    paraEntidade: (
      row: Record<string, unknown>,
    ) => Partial<Omit<Entidade, 'id'>>;
  },
): Promise<void> {
  const linhas = await origemQuery<Record<string, unknown>>(
    origem,
    `SELECT ${opts.colunasSql} FROM ${opts.tabelaOrigem} ORDER BY id`,
  );
  if (!aplicar) {
    relatorios.push({
      tabela: opts.tabelaOrigem,
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run (upsert por slug)',
    });
    return;
  }
  const repo: Repository<Entidade> = ds.getRepository(opts.entidade);
  let novos = 0;
  let atualizados = 0;
  for (const linha of linhas) {
    const slug = ((linha.slug as string) ?? '').trim();
    if (!slug) continue;
    const existente = await repo.findOne({
      where: { slug } as unknown as FindOptionsWhere<Entidade>,
    });
    const campos = opts.paraEntidade(linha) as unknown as DeepPartial<Entidade>;
    if (existente) {
      await repo.save(repo.merge(existente, campos));
      atualizados++;
    } else {
      await repo.save(repo.create(campos));
      novos++;
    }
  }
  relatorios.push({
    tabela: opts.tabelaOrigem,
    origem: linhas.length,
    migrados: novos + atualizados,
    observacao: `${novos} novo(s), ${atualizados} já existiam (atualizados com o dado da origem)`,
  });
}

// --- Catálogos "substituir por completo" (checklist_modelo / indice_topicos) -----
// O destino já nasce semeado do MESMO YAML compartilhado, mas o ADM pode ter editado
// além do YAML original (telas de Cadastro) — a origem é a fonte da verdade real.

async function substituirCatalogo<Entidade extends { id: number }>(
  origem: PgClient,
  ds: DataSource,
  opts: {
    tabelaOrigem: string;
    entidade: new () => Entidade;
    colunasSql: string;
    paraEntidade: (row: Record<string, unknown>) => Partial<Entidade>;
  },
): Promise<void> {
  const linhas = await origemQuery<Record<string, unknown>>(
    origem,
    `SELECT ${opts.colunasSql} FROM ${opts.tabelaOrigem} ORDER BY id`,
  );
  if (!aplicar) {
    relatorios.push({
      tabela: opts.tabelaOrigem,
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run (substitui o catálogo)',
    });
    return;
  }
  const repo: Repository<Entidade> = ds.getRepository(opts.entidade);
  await repo.clear();
  for (const linha of linhas) {
    const campos = opts.paraEntidade(linha) as unknown as DeepPartial<Entidade>;
    await repo.save(repo.create(campos));
  }
  relatorios.push({
    tabela: opts.tabelaOrigem,
    origem: linhas.length,
    migrados: linhas.length,
    observacao: 'catálogo do destino substituído pelo da origem',
  });
}

// --- Modelos de Documento (upsert por slug + remapeamento de id p/ versões/campos) ---

async function migrarModelosDocumento(
  origem: PgClient,
  ds: DataSource,
): Promise<Map<number, number>> {
  interface Row {
    id: number;
    slug: string;
    nome: string;
    fase: string;
    tipo: string;
    arquivo: string;
    descricao: string;
    ordem: number;
    atualizado_em: Date;
  }
  const linhas = await origemQuery<Row>(
    origem,
    'SELECT id, slug, nome, fase, tipo, arquivo, descricao, ordem, atualizado_em FROM modelos_documento ORDER BY id',
  );
  const remapa = new Map<number, number>();
  if (!aplicar) {
    relatorios.push({
      tabela: 'modelos_documento',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return remapa;
  }
  const repo = ds.getRepository(ModeloDocumento);
  for (const r of linhas) {
    const slug = (r.slug || '').trim();
    const existente = slug ? await repo.findOne({ where: { slug } }) : null;
    const campos = {
      slug,
      nome: r.nome || '',
      fase: r.fase || '',
      tipo: (r.tipo as ModeloDocumento['tipo']) || 'docx',
      arquivo: r.arquivo || '',
      descricao: r.descricao || '',
      ordem: r.ordem || 0,
    };
    const salvo = existente
      ? await repo.save(repo.merge(existente, campos))
      : await repo.save(repo.create(campos));
    remapa.set(r.id, salvo.id);
  }
  relatorios.push({
    tabela: 'modelos_documento',
    origem: linhas.length,
    migrados: linhas.length,
    observacao: 'upsert por slug',
  });
  return remapa;
}

async function migrarModelosDocumentoVersoes(
  origem: PgClient,
  ds: DataSource,
  remapaModelo: Map<number, number>,
): Promise<void> {
  interface Row {
    id: number;
    modelo_id: number;
    versao: number;
    arquivo: string;
    autor: string;
    motivo: string;
    vigente: number | boolean;
    criado_em: Date;
  }
  const linhas = await origemQuery<Row>(
    origem,
    'SELECT id, modelo_id, versao, arquivo, autor, motivo, vigente, criado_em FROM modelos_documento_versoes ORDER BY id',
  );
  if (!aplicar) {
    relatorios.push({
      tabela: 'modelos_documento_versoes',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  const destinoDir = join(process.cwd(), 'dados', 'modelos_documento');
  let semArquivo = 0;
  let semModelo = 0;
  for (const r of linhas) {
    const novoModeloId = remapaModelo.get(r.modelo_id);
    if (!novoModeloId) {
      semModelo++;
      continue;
    }
    const dadosDir = process.env.MIGRACAO_ORIGEM_DADOS_DIR;
    const caminhoOrigem = dadosDir
      ? join(dadosDir, 'modelos_documento', r.arquivo)
      : '';
    const novoCaminho = caminhoOrigem
      ? copiarArquivoSePossivel(caminhoOrigem, destinoDir, r.arquivo)
      : null;
    if (!novoCaminho) semArquivo++;
    await upsertComId(ds, ModeloDocumentoVersao, {
      id: r.id,
      modeloId: novoModeloId,
      versao: r.versao || 1,
      arquivo: r.arquivo || '',
      autor: r.autor || '',
      motivo: r.motivo || '',
      vigente: Boolean(r.vigente),
      criadoEm: r.criado_em,
    });
  }
  await ajustarSequence(ds, 'modelos_documento_versoes');
  relatorios.push({
    tabela: 'modelos_documento_versoes',
    origem: linhas.length,
    migrados: linhas.length - semModelo,
    observacao:
      (semModelo
        ? `${semModelo} ignorada(s) por não achar o modelo remapeado; `
        : '') +
      (semArquivo
        ? `${semArquivo} sem o arquivo físico encontrado (defina MIGRACAO_ORIGEM_DADOS_DIR)`
        : 'ok'),
  });
}

async function migrarModelosDocumentoCampos(
  origem: PgClient,
  ds: DataSource,
  remapaModelo: Map<number, number>,
): Promise<void> {
  interface Row {
    id: number;
    modelo_id: number;
    ordem: number;
    secao: string;
    placeholder: string;
    rotulo: string;
    origem: string;
    obrigatorio: number | boolean;
    observacao: string;
  }
  const linhas = await origemQuery<Row>(
    origem,
    'SELECT id, modelo_id, ordem, secao, placeholder, rotulo, origem, obrigatorio, observacao FROM modelos_documento_campos ORDER BY id',
  );
  if (!aplicar) {
    relatorios.push({
      tabela: 'modelos_documento_campos',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  let semModelo = 0;
  for (const r of linhas) {
    const novoModeloId = remapaModelo.get(r.modelo_id);
    if (!novoModeloId) {
      semModelo++;
      continue;
    }
    await upsertComId(ds, ModeloDocumentoCampo, {
      id: r.id,
      modeloId: novoModeloId,
      ordem: r.ordem || 0,
      secao: r.secao || '',
      placeholder: r.placeholder || '',
      rotulo: r.rotulo || '',
      origem: r.origem || '',
      obrigatorio: Boolean(r.obrigatorio),
      observacao: r.observacao || '',
    });
  }
  await ajustarSequence(ds, 'modelos_documento_campos');
  relatorios.push({
    tabela: 'modelos_documento_campos',
    origem: linhas.length,
    migrados: linhas.length - semModelo,
    observacao: semModelo
      ? `${semModelo} ignorada(s) por não achar o modelo remapeado`
      : undefined,
  });
}

// --- MatrizTecnico: upsert por nome (aditivo, mesma regra da importação de planilha) ---

async function migrarMatrizTecnicos(
  origem: PgClient,
  ds: DataSource,
): Promise<void> {
  interface Row {
    id: number;
    nome: string;
    setor: string;
    dias: string;
    notas: string;
    atualizado_em: Date | null;
    atualizado_por: string;
  }
  const linhas = await origemQuery<Row>(
    origem,
    'SELECT id, nome, setor, dias, notas, atualizado_em, atualizado_por FROM matriz_tecnicos ORDER BY id',
  );
  if (!aplicar) {
    relatorios.push({
      tabela: 'matriz_tecnicos',
      origem: linhas.length,
      migrados: 0,
      observacao: 'dry-run',
    });
    return;
  }
  for (const r of linhas) {
    await upsertComId(ds, MatrizTecnico, {
      id: r.id,
      nome: r.nome || '',
      setor: r.setor || '',
      dias: r.dias || '',
      notas: r.notas || '{}',
      atualizadoEm: r.atualizado_em,
      atualizadoPor: r.atualizado_por || '',
    });
  }
  await ajustarSequence(ds, 'matriz_tecnicos');
  relatorios.push({
    tabela: 'matriz_tecnicos',
    origem: linhas.length,
    migrados: linhas.length,
  });
}

// --- Relatório final ---------------------------------------------------------------

function imprimirRelatorio(): void {
  log('');
  log('='.repeat(78));
  log(
    aplicar
      ? 'MIGRAÇÃO APLICADA'
      : 'DRY-RUN (nada foi gravado — rode com --aplicar para migrar de verdade)',
  );
  log('='.repeat(78));
  const larguraTabela = Math.max(...relatorios.map((r) => r.tabela.length), 10);
  for (const r of relatorios) {
    const linha = `${r.tabela.padEnd(larguraTabela)}  origem=${String(r.origem).padStart(6)}  migrados=${String(r.migrados).padStart(6)}`;
    log(r.observacao ? `${linha}  (${r.observacao})` : linha);
  }
  log('='.repeat(78));
}

function gravarSenhasTemporarias(senhas: SenhaTemp[]): void {
  if (senhas.length === 0) return;
  const dir = join(process.cwd(), 'dados');
  mkdirSync(dir, { recursive: true });
  const caminho = join(dir, 'migracao-senhas-temporarias.csv');
  const linhas = [
    'login,nome,email,senha_temporaria',
    ...senhas.map((s) => `${s.login},${s.nome},${s.email},${s.senha}`),
  ];
  writeFileSync(caminho, linhas.join('\n'), 'utf8');
  log('');
  log(
    `ATENÇÃO — senhas temporárias de ${senhas.length} usuário(s) gravadas em:`,
  );
  log(`  ${caminho}`);
  log(
    'Este arquivo contém SENHAS EM TEXTO PLANO — trate como segredo: distribua por um',
  );
  log(
    'canal seguro e apague o arquivo depois. Cada usuário deve trocar a senha no',
  );
  log(
    'primeiro acesso (ainda não há tela de "trocar senha" própria — troque via ADM →',
  );
  log('Usuários, editando o campo Senha).');
}

async function main(): Promise<void> {
  log(
    `Modo: ${aplicar ? 'APLICAR (vai gravar no destino)' : 'DRY-RUN (só relatório)'}`,
  );

  const origem = await origemConectar();
  await AppDataSource.initialize();
  const ds = AppDataSource;

  try {
    if (aplicar && !continuar) {
      const usuariosRows = await ds.query<{ count: number }[]>(
        'SELECT COUNT(*)::int AS count FROM usuarios',
      );
      const projetosRows = await ds.query<{ count: number }[]>(
        'SELECT COUNT(*)::int AS count FROM projetos',
      );
      const usuariosExistentes = usuariosRows[0].count;
      const projetosExistentes = projetosRows[0].count;
      if (usuariosExistentes > 0 || projetosExistentes > 0) {
        throw new Error(
          `O destino já tem ${usuariosExistentes} usuário(s) e ${projetosExistentes} projeto(s) — ` +
            'rodar a migração agora arrisca duplicar/sobrescrever dados reais. Se isto é uma ' +
            'RETOMADA intencional de uma migração anterior (idempotente — cada tabela faz ' +
            'upsert pelo id original), rode de novo com --aplicar --continuar. Se não, aponte ' +
            'MIGRACAO_DB_URL para um Postgres vazio (só com as migrations aplicadas, SEM ' +
            'rodar seed:admin antes — este script já traz os usuários reais).',
        );
      }
    }

    const senhas = await migrarUsuarios(origem, ds);

    await migrarTabelaSimples<Projeto>(origem, ds, {
      tabelaOrigem: 'projetos',
      entidade: Projeto,
      colunas: [
        { origem: 'cliente', destino: 'cliente' },
        { origem: 'cnpj', destino: 'cnpj' },
        { origem: 'numero_projeto', destino: 'numeroProjeto' },
        { origem: 'numero_proposta', destino: 'numeroProposta' },
        { origem: 'ramo', destino: 'ramo' },
        { origem: 'responsavel', destino: 'responsavel' },
        { origem: 'consultor', destino: 'consultor' },
        { origem: 'gci', destino: 'gci' },
        { origem: 'etapa', destino: 'etapa' },
        { origem: 'situacao', destino: 'situacao' },
        { origem: 'data_inicio', destino: 'dataInicio' },
        { origem: 'data_levantamento', destino: 'dataLevantamento' },
        { origem: 'data_uso_oficial', destino: 'dataUsoOficial' },
        { origem: 'data_encerramento', destino: 'dataEncerramento' },
        { origem: 'horas_cobradas', destino: 'horasCobradas' },
        { origem: 'horas_bonificadas', destino: 'horasBonificadas' },
        { origem: 'modulos', destino: 'modulos' },
        { origem: 'contato_nome', destino: 'contatoNome' },
        { origem: 'contato_email', destino: 'contatoEmail' },
        { origem: 'contato_tel', destino: 'contatoTel' },
        { origem: 'contatos', destino: 'contatos' },
        { origem: 'observacoes', destino: 'observacoes' },
        { origem: 'criado_em', destino: 'criadoEm', ehData: true },
      ],
    });

    await migrarDocumentos(origem, ds);

    await migrarTabelaSimples<Evento>(origem, ds, {
      tabelaOrigem: 'eventos',
      entidade: Evento,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'tipo', destino: 'tipo' },
        { origem: 'descricao', destino: 'descricao' },
        { origem: 'autor', destino: 'autor' },
        { origem: 'criado_em', destino: 'criadoEm', ehData: true },
      ],
    });

    await migrarTabelaSimples<Designacao>(origem, ds, {
      tabelaOrigem: 'designacoes',
      entidade: Designacao,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'modulo', destino: 'modulo' },
        { origem: 'consultor', destino: 'consultor' },
        { origem: 'ordem', destino: 'ordem' },
        {
          origem: 'nao_distribuir',
          destino: 'naoDistribuir',
          converter: Boolean,
        },
        { origem: 'analista', destino: 'analista' },
      ],
    });

    await migrarTabelaSimples<CronogramaItem>(origem, ds, {
      tabelaOrigem: 'cronograma_itens',
      entidade: CronogramaItem,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'ordem', destino: 'ordem' },
        { origem: 'etapa', destino: 'etapa' },
        { origem: 'topicos', destino: 'topicos' },
        { origem: 'horas', destino: 'horas' },
        { origem: 'data', destino: 'data' },
        { origem: 'modalidade', destino: 'modalidade' },
        { origem: 'status', destino: 'status' },
      ],
    });

    await migrarTabelaSimples<ChecklistItem>(origem, ds, {
      tabelaOrigem: 'checklist_itens',
      entidade: ChecklistItem,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'ordem', destino: 'ordem' },
        { origem: 'modulo', destino: 'modulo' },
        { origem: 'item', destino: 'item' },
        { origem: 'responsavel', destino: 'responsavel' },
        { origem: 'status', destino: 'status' },
        { origem: 'obs', destino: 'obs' },
      ],
    });

    await migrarTabelaSimples<Modificacao>(origem, ds, {
      tabelaOrigem: 'modificacoes',
      entidade: Modificacao,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'entidade', destino: 'entidade' },
        { origem: 'ref', destino: 'ref' },
        { origem: 'campo', destino: 'campo' },
        { origem: 'de', destino: 'de' },
        { origem: 'para', destino: 'para' },
        { origem: 'autor', destino: 'autor' },
        { origem: 'criado_em', destino: 'criadoEm', ehData: true },
      ],
    });

    await migrarTabelaSimples<AtividadeCronograma>(origem, ds, {
      tabelaOrigem: 'cronograma_atividades',
      entidade: AtividadeCronograma,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'modulo', destino: 'modulo' },
        { origem: 'seq', destino: 'seq' },
        { origem: 'ordem', destino: 'ordem' },
        { origem: 'descricao', destino: 'descricao' },
        { origem: 'tipo', destino: 'tipo' },
        { origem: 'data', destino: 'data' },
        { origem: 'turno', destino: 'turno' },
        { origem: 'tecnico', destino: 'tecnico' },
        { origem: 'status', destino: 'status' },
        { origem: 'nova_data', destino: 'novaData' },
        { origem: 'novo_turno', destino: 'novoTurno' },
        { origem: 'origem_id', destino: 'origemId' },
        { origem: 'is_copia', destino: 'isCopia', converter: Boolean },
        {
          origem: 'auto_agendado',
          destino: 'autoAgendado',
          converter: Boolean,
        },
      ],
    });

    await migrarTabelaSimples<SlotCronograma>(origem, ds, {
      tabelaOrigem: 'cronograma_slots',
      entidade: SlotCronograma,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'data', destino: 'data' },
        { origem: 'turno', destino: 'turno' },
        { origem: 'hora_inicio', destino: 'horaInicio' },
        { origem: 'hora_fim', destino: 'horaFim' },
      ],
    });

    await migrarTabelaSimples<CronogramaConfig>(origem, ds, {
      tabelaOrigem: 'cronograma_config',
      entidade: CronogramaConfig,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'modo_disponibilidade', destino: 'modoDisponibilidade' },
        { origem: 'data_inicio', destino: 'dataInicio' },
        { origem: 'dias_turnos_excluidos', destino: 'diasTurnosExcluidos' },
        { origem: 'analista_padrao', destino: 'analistaPadrao' },
      ],
    });

    await migrarTabelaSimples<CronogramaPeriodoBloqueado>(origem, ds, {
      tabelaOrigem: 'cronograma_periodos_bloqueados',
      entidade: CronogramaPeriodoBloqueado,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'data_ini', destino: 'dataIni' },
        { origem: 'data_fim', destino: 'dataFim' },
        { origem: 'motivo', destino: 'motivo' },
        { origem: 'tecnicos', destino: 'tecnicos' },
      ],
    });

    await migrarTabelaSimples<LevantamentoResposta>(origem, ds, {
      tabelaOrigem: 'levantamento_respostas',
      entidade: LevantamentoResposta,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'ordem', destino: 'ordem' },
        { origem: 'modulo_sigla', destino: 'moduloSigla' },
        { origem: 'modulo', destino: 'modulo' },
        { origem: 'adicional', destino: 'adicional' },
        { origem: 'topico', destino: 'topico' },
        { origem: 'resposta', destino: 'resposta' },
      ],
    });

    await migrarTabelaSimples<DocConteudo>(origem, ds, {
      tabelaOrigem: 'doc_conteudo',
      entidade: DocConteudo,
      colunas: [
        { origem: 'projeto_id', destino: 'projetoId' },
        { origem: 'doc', destino: 'doc' },
        { origem: 'campo', destino: 'campo' },
        { origem: 'valor', destino: 'valor' },
      ],
    });

    await migrarProtocolos(origem, ds);

    await migrarTabelaSimples<MatrizCompetencia>(origem, ds, {
      tabelaOrigem: 'matriz_competencias',
      entidade: MatrizCompetencia,
      colunas: [
        { origem: 'sigla', destino: 'sigla' },
        { origem: 'area', destino: 'area' },
        { origem: 'ordem', destino: 'ordem' },
      ],
    });

    await migrarMatrizTecnicos(origem, ds);

    await upsertPorSlug<ConsultaBD>(origem, ds, {
      tabelaOrigem: 'consultas_bd',
      entidade: ConsultaBD,
      colunasSql: 'id, slug, nome, sql, ordem',
      paraEntidade: (row) => ({
        slug: txt(row.slug),
        nome: txt(row.nome),
        sql: txt(row.sql),
        ordem: Number(row.ordem ?? 0),
        // colunaData/colunaSituacao/mostrarGrafico não existiam na origem — ficam no
        // default (''/''/false); o ADM configura depois em Config → Consultas BD se
        // quiser que esta consulta vire um Dashboard.
      }),
    });

    await upsertPorSlug<ModeloEmail>(origem, ds, {
      tabelaOrigem: 'modelos_email',
      entidade: ModeloEmail,
      colunasSql: 'id, slug, nome, assunto, corpo, etapa, ativo, padrao',
      paraEntidade: (row) => ({
        slug: txt(row.slug),
        nome: txt(row.nome),
        assunto: txt(row.assunto),
        corpo: txt(row.corpo),
        etapa: txt(row.etapa),
        ativo: Boolean(row.ativo),
        padrao: Boolean(row.padrao),
      }),
    });

    await substituirCatalogo<ChecklistModelo>(origem, ds, {
      tabelaOrigem: 'checklist_modelo',
      entidade: ChecklistModelo,
      colunasSql:
        'id, ordem, modulo, adicional, tipo, integracoes, golive, menu, item, acao, seq',
      paraEntidade: (row) => ({
        ordem: Number(row.ordem ?? 0),
        modulo: txt(row.modulo),
        adicional: txt(row.adicional),
        tipo: txt(row.tipo),
        integracoes: txt(row.integracoes),
        golive: txt(row.golive),
        menu: txt(row.menu),
        item: txt(row.item),
        acao: txt(row.acao),
        seq: txt(row.seq),
      }),
    });

    await substituirCatalogo<IndiceTopico>(origem, ds, {
      tabelaOrigem: 'indice_topicos',
      entidade: IndiceTopico,
      colunasSql:
        'id, ordem, modulo_num, modulo_sigla, modulo, adicional_num, adicional_sigla, adicional, topico',
      paraEntidade: (row) => ({
        ordem: Number(row.ordem ?? 0),
        moduloNum: txt(row.modulo_num),
        moduloSigla: txt(row.modulo_sigla),
        modulo: txt(row.modulo),
        adicionalNum: txt(row.adicional_num),
        adicionalSigla: txt(row.adicional_sigla),
        adicional: txt(row.adicional),
        topico: txt(row.topico),
      }),
    });

    const remapaModelo = await migrarModelosDocumento(origem, ds);
    await migrarModelosDocumentoVersoes(origem, ds, remapaModelo);
    await migrarModelosDocumentoCampos(origem, ds, remapaModelo);

    imprimirRelatorio();
    gravarSenhasTemporarias(senhas);
  } finally {
    await origem.end();
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Falha na migração:', err instanceof Error ? err.message : err);
  process.exit(1);
});
