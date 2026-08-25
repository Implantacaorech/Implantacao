import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Database from 'better-sqlite3';
import { appendFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import {
  ACOES,
  AcaoConsulta,
  AssuntoRelacionado,
  FonteEvidencia,
  InterpretacaoPergunta,
  ItemSecao,
  MODULOS_CLIENTE,
  PESOS,
  RespostaConsultorSiger,
  RUIDO_MENU,
  SINONIMOS,
  STOPWORDS,
  StatusConsultorSiger,
  TIPOS_FORTES,
  VERSAO_ATUAL,
  VERSAO_COBOL,
  VisaoConsulta,
} from './consultor-siger.constants';

/** Linha de chunk vinda do FTS, já com a pontuação bm25 (negativa) anexada. */
interface LinhaChunk {
  id: number;
  entidade: number | null;
  tipo: string;
  modulo: string | null;
  referencia: string | null;
  arquivo: string;
  linha: number;
  versao: string;
  texto: string;
  score: number;
}

const AVISO_INDISPONIVEL =
  'A base de conhecimento do Consultor SIGER não está disponível neste ambiente. ' +
  'Gere-a com o indexador (F:\\CONSULTOR-SIGER\\indexer\\extrair.py) ou ajuste ' +
  'MIGRACAO_CONSULTOR_SIGER_DB para o caminho correto.';

const AVISO_SEM_EVIDENCIA =
  'Não foi localizada evidência suficiente na fonte do SIGER para responder a esta pergunta.';

/** Tela **Execução → Consultor SIGER** — base inteligente de conhecimento do SIGER para os
 * Consultores de Implantação. Pesquisa EXTRATIVA sobre a base derivada do código-fonte
 * (menus, tabelas, telas, helps, parâmetros, histórico): nada é redigido por modelo — todo
 * item de resposta é um trecho real da fonte com `arquivo:linha` citados, e a regra
 * anti-invenção é estrutural. A fonte original `F:\SIGER` é SOMENTE LEITURA e o Painel
 * sequer a acessa: consome apenas o SQLite derivado, aberto em modo somente leitura. */
@Injectable()
export class ConsultorSigerService implements OnModuleDestroy {
  private readonly logger = new Logger(ConsultorSigerService.name);
  private readonly caminhoDb: string;
  private db: Database.Database | null = null;
  private nomesModulos = new Map<string, string>();

  constructor(config: ConfigService) {
    this.caminhoDb =
      config.get<string>('consultorSiger.dbPath') ??
      'F:\\CONSULTOR-SIGER\\data\\consultor.db';
  }

  /** Fecha a conexão com a base derivada (shutdown do Nest e testes). */
  onModuleDestroy(): void {
    this.fechar();
  }

  fechar(): void {
    this.db?.close();
    this.db = null;
  }

  /** Abre a base derivada em SOMENTE LEITURA (lazy — o boot não depende do drive F:). */
  private abrir(): Database.Database | null {
    if (this.db) return this.db;
    try {
      if (!existsSync(this.caminhoDb)) return null;
      this.db = new Database(this.caminhoDb, {
        readonly: true,
        fileMustExist: true,
      });
      this.nomesModulos = new Map(
        (
          this.db
            .prepare("select codigo, nome from entidade where tipo='modulo'")
            .all() as Array<{ codigo: string; nome: string }>
        ).map((r) => [r.codigo, limparNomeModulo(r.nome)]),
      );
      return this.db;
    } catch (e) {
      this.logger.warn(
        `Base do Consultor SIGER inacessível: ${(e as Error).message}`,
      );
      this.db = null;
      return null;
    }
  }

  status(): StatusConsultorSiger {
    const db = this.abrir();
    if (!db) {
      return {
        disponivel: false,
        caminho: this.caminhoDb,
        entidades: 0,
        chunks: 0,
        atualizadoEm: null,
        versaoCobol: VERSAO_COBOL,
        versaoAtual: VERSAO_ATUAL,
      };
    }
    try {
      const conta = (sql: string): number =>
        (db.prepare(sql).get() as { n: number }).n;
      return {
        disponivel: true,
        caminho: this.caminhoDb,
        entidades: conta('select count(*) as n from entidade'),
        chunks: conta('select count(*) as n from chunk'),
        atualizadoEm: statSync(this.caminhoDb).mtime.toISOString(),
        versaoCobol: VERSAO_COBOL,
        versaoAtual: VERSAO_ATUAL,
      };
    } catch (e) {
      // A base fica num drive de rede: queda do share no meio de uma leitura não pode
      // virar 500 nem envenenar a conexão — fecha para reabrir quando o drive voltar.
      this.logger.warn(
        `Base do Consultor SIGER falhou na leitura: ${(e as Error).message}`,
      );
      this.fechar();
      return {
        disponivel: false,
        caminho: this.caminhoDb,
        entidades: 0,
        chunks: 0,
        atualizadoEm: null,
        versaoCobol: VERSAO_COBOL,
        versaoAtual: VERSAO_ATUAL,
      };
    }
  }

  /** Registra a avaliação do consultor sobre uma resposta — JSONL ao lado da base derivada
   * (fora da fonte e fora do repositório), para alimentar a calibração das próximas fases. */
  registrarFeedback(
    pergunta: string,
    util: boolean,
    observacao: string | undefined,
    usuario: string | undefined,
  ): { ok: boolean } {
    const destino = join(dirname(this.caminhoDb), 'feedback-portal.jsonl');
    try {
      mkdirSync(dirname(destino), { recursive: true });
      appendFileSync(
        destino,
        `${JSON.stringify({ data: new Date().toISOString(), pergunta, util, observacao: observacao ?? '', usuario: usuario ?? '' })}\n`,
        'utf8',
      );
      return { ok: true };
    } catch (e) {
      // Feedback é acessório: indisponibilidade do drive não pode derrubar a consulta.
      this.logger.warn(`Falha ao registrar feedback: ${(e as Error).message}`);
      return { ok: false };
    }
  }

  pesquisar(
    pergunta: string,
    visao: VisaoConsulta = 'funcional',
  ): RespostaConsultorSiger {
    const resposta: RespostaConsultorSiger = {
      pergunta,
      visao,
      disponivel: true,
      interpretacao: null,
      secoes: {},
      assuntosRelacionados: [],
      sugestoes: [],
      fontes: [],
      confianca: 'nao_confirmado',
      aviso: null,
    };
    const db = this.abrir();
    if (!db) {
      resposta.disponivel = false;
      resposta.aviso = AVISO_INDISPONIVEL;
      return resposta;
    }

    const interp = interpretar(pergunta);
    resposta.interpretacao = interp;
    const achados = this.buscarChunks(db, interp);
    if (!achados.length) {
      resposta.aviso = AVISO_SEM_EVIDENCIA;
      return resposta;
    }

    const porTipo = new Map<string, LinhaChunk[]>();
    for (const r of achados) {
      const lista = porTipo.get(r.tipo) ?? [];
      lista.push(r);
      porTipo.set(r.tipo, lista);
    }
    const secao = (
      nome: string,
      tipos: string[],
      maxItens: number,
      tam = 420,
    ): void => {
      const itens: ItemSecao[] = [];
      for (const t of tipos) {
        for (const r of (porTipo.get(t) ?? []).slice(0, maxItens)) {
          itens.push({ texto: resumir(r.texto, tam), fonte: fonteDe(r) });
        }
        if (itens.length >= maxItens) break;
      }
      if (itens.length) resposta.secoes[nome] = itens.slice(0, maxItens);
    };

    this.montarResumoModulo(db, interp, resposta);
    if (!resposta.secoes['resumo'])
      secao('resumo', ['help', 'modulo', 'menu', 'tabela'], 2, 700);
    secao('comoFunciona', ['help', 'historico', 'tela'], 4, 500);
    secao('regrasValidacoes', ['tela_validacao', 'mensagens'], 5, 420);
    secao(
      'configuracoes',
      interp.acao === 'configuracao'
        ? ['parametro', 'menu', 'tabela']
        : ['parametro', 'menu'],
      6,
      320,
    );
    secao('cadastros', ['tabela'], 6, 320);
    secao('telasMenus', ['menu', 'tela'], 6, 260);
    secao('alteracoesRecentes', ['changelog'], 3, 420);
    if (visao === 'tecnica') {
      secao('origemTecnica', ['codigo', 'programa', 'tabela_campos'], 6, 500);
    }

    resposta.assuntosRelacionados = this.relacionados(db, achados, porTipo);
    resposta.sugestoes = sugestoes(interp);
    resposta.fontes = fontesConsolidadas(achados);
    this.classificarConfianca(resposta, interp, achados, porTipo);
    return resposta;
  }

  /** Busca FTS + reponderação por tipo/intenção + dedupe (o RLS repete o mesmo programa em
   * várias eras — só o melhor de cada referência sobrevive). */
  private buscarChunks(
    db: Database.Database,
    interp: InterpretacaoPergunta,
    limite = 90,
  ): LinhaChunk[] {
    if (!interp.termosExpandidos.length) return [];
    const consulta = interp.termosExpandidos
      .slice(0, 18)
      .map((t) => `"${t.replace(/"/g, '')}"`)
      .join(' OR ');
    let linhas: LinhaChunk[];
    try {
      linhas = db
        .prepare(
          `select c.id, c.entidade, c.tipo, c.modulo, c.referencia, c.arquivo,
                  c.linha, c.versao, c.texto, bm25(chunk_fts) as score
             from chunk_fts join chunk c on c.id = chunk_fts.rowid
            where chunk_fts match ?
            order by score limit ?`,
        )
        .all(consulta, limite * 3) as LinhaChunk[];
    } catch (e) {
      // Consulta FTS malformada não pode virar 500 — vira "sem achados". Erro de I/O
      // (queda do drive de rede) também: fecha a conexão para reabrir na próxima chamada,
      // senão o handle quebrado continuaria falhando mesmo depois de o drive voltar.
      this.logger.warn(`Consulta à base falhou: ${(e as Error).message}`);
      if (/i\/o|disk|database|malformed/i.test((e as Error).message))
        this.fechar();
      return [];
    }
    const pesos = PESOS[interp.acao] ?? {};
    const pontuados: Array<{ pontos: number; linha: LinhaChunk }> = [];
    for (const r of linhas) {
      if (r.tipo === 'menu' && RUIDO_MENU.test(r.texto ?? '')) continue;
      // bm25 é NEGATIVO: dividir por peso < 1 melhora a posição; > 1 piora (ver constants).
      let pontos = r.score / (pesos[r.tipo] ?? 1.0);
      if (r.tipo === 'historico' && r.modulo && MODULOS_CLIENTE.has(r.modulo)) {
        pontos /= 1.6;
      }
      const ref = normalizar(r.referencia ?? '');
      if (interp.termos.some((t) => ref.includes(t))) pontos /= 0.6;
      pontuados.push({ pontos, linha: r });
    }
    pontuados.sort((a, b) => a.pontos - b.pontos);
    const vistos = new Set<string>();
    const unicos: LinhaChunk[] = [];
    for (const p of pontuados) {
      const chave = p.linha.referencia ?? String(p.linha.id);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      unicos.push(p.linha);
      if (unicos.length >= limite) break;
    }
    return unicos;
  }

  /** Pergunta que cita um sistema inteiro ("como funciona o faturamento") abre com a visão
   * do módulo: nome + grupos de menu reais, extraídos do XXX005 — nunca texto inventado. */
  private montarResumoModulo(
    db: Database.Database,
    interp: InterpretacaoPergunta,
    resposta: RespostaConsultorSiger,
  ): void {
    for (const [codigo, nome] of this.nomesModulos) {
      const nomeNorm = normalizar(nome);
      if (!interp.termos.some((t) => t.length > 4 && nomeNorm.includes(t)))
        continue;
      const grupos = (
        db
          .prepare(
            `select distinct json_extract(extra,'$.contexto') as ctx from entidade
              where tipo='menu_opcao' and modulo=? and extra is not null limit 12`,
          )
          .all(codigo) as Array<{ ctx: string | null }>
      )
        .map((r) => r.ctx ?? '')
        .filter((c) => c.toLowerCase().startsWith('menu'));
      if (grupos.length < 3) continue; // não é um sistema completo com menus próprios
      const arq = db
        .prepare(
          "select arquivo from entidade where tipo='modulo' and codigo=?",
        )
        .get(codigo) as { arquivo: string } | undefined;
      resposta.secoes['resumo'] = [
        {
          texto:
            `${nome} é um dos módulos do SIGER (código ${codigo}). ` +
            `Sua estrutura de menus organiza: ` +
            grupos
              .slice(0, 10)
              .map((g) => g.split(' - ').slice(-1)[0])
              .join('; ') +
            '.',
          fonte: {
            arquivo: arq?.arquivo ?? '',
            linha: 1,
            versao: VERSAO_COBOL,
            referencia: `módulo ${codigo}`,
            tipo: 'modulo',
          },
        },
      ];
      return;
    }
  }

  private relacionados(
    db: Database.Database,
    achados: LinhaChunk[],
    porTipo: Map<string, LinhaChunk[]>,
  ): AssuntoRelacionado[] {
    const contagemModulos = new Map<string, number>();
    for (const r of achados) {
      if (r.modulo)
        contagemModulos.set(r.modulo, (contagemModulos.get(r.modulo) ?? 0) + 1);
    }
    const lista: AssuntoRelacionado[] = [];
    for (const [mod] of [...contagemModulos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)) {
      const nome = this.nomesModulos.get(mod) ?? mod;
      lista.push({ titulo: nome, pesquisa: `como funciona ${nome}` });
    }
    const idsEntidades = achados
      .map((r) => r.entidade)
      .filter((v): v is number => !!v)
      .slice(0, 30);
    if (idsEntidades.length) {
      const marcadores = idsEntidades.map(() => '?').join(',');
      const vizinhos = db
        .prepare(
          `select distinct e.nome from entidade e
            where e.id in (select destino from relacao where origem in (${marcadores}))
               or e.id in (select origem from relacao where destino in (${marcadores}))
            limit 6`,
        )
        .all(...idsEntidades, ...idsEntidades) as Array<{ nome: string }>;
      for (const v of vizinhos) {
        lista.push({ titulo: v.nome, pesquisa: `como funciona ${v.nome}` });
      }
    }
    for (const r of (porTipo.get('programa') ?? []).slice(0, 3)) {
      if (!r.entidade) continue;
      const ext = db
        .prepare('select extra from entidade where id=?')
        .get(r.entidade) as { extra: string | null } | undefined;
      if (!ext?.extra) continue;
      try {
        const tabelas =
          (JSON.parse(ext.extra) as { tabelas?: string[] }).tabelas ?? [];
        for (const tab of tabelas.slice(0, 4)) {
          lista.push({ titulo: `tabela ${tab}`, pesquisa: `tabela ${tab}` });
        }
      } catch {
        /* extra malformado não derruba a resposta */
      }
    }
    const vistos = new Set<string>();
    return lista
      .filter((a) => {
        const chave = normalizar(a.titulo);
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
      .slice(0, 10);
  }

  /** Confiança = evidência direta × diversidade × COBERTURA dos termos originais — uma
   * pergunta cujos termos mal aparecem nos achados nunca sai como "alta". */
  private classificarConfianca(
    resposta: RespostaConsultorSiger,
    interp: InterpretacaoPergunta,
    achados: LinhaChunk[],
    porTipo: Map<string, LinhaChunk[]>,
  ): void {
    const textoTopo = normalizar(
      achados
        .slice(0, 12)
        .map((r) => r.texto)
        .join(' '),
    );
    const termosUteis = interp.termos.filter((t) => t.length > 3);
    // Radical leve: "configurar" precisa casar com "configuração" etc.
    const cobertos = termosUteis.filter((t) =>
      textoTopo.includes(t.slice(0, Math.max(4, t.length - 4))),
    ).length;
    const cobertura = termosUteis.length ? cobertos / termosUteis.length : 0;
    const fortes = [...porTipo.keys()].filter((t) =>
      TIPOS_FORTES.has(t),
    ).length;
    if (cobertura >= 0.75 && fortes >= 2 && achados.length >= 8) {
      resposta.confianca = 'alta';
    } else if (cobertura >= 0.6 && fortes >= 1 && achados.length >= 4) {
      resposta.confianca = 'media';
    } else {
      resposta.confianca = 'baixa';
      if (cobertura < 0.5) {
        resposta.aviso =
          'Parte dos termos da pergunta não foi localizada na fonte — os resultados ' +
          'podem ser apenas parcialmente relacionados.';
      }
    }
  }
}

export function normalizar(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function limparNomeModulo(nome: string): string {
  return nome.replace(/programa de menus do sistema de /i, '');
}

export function interpretar(pergunta: string): InterpretacaoPergunta {
  const norm = normalizar(pergunta);
  let acao: AcaoConsulta = 'funcionamento';
  for (const [nome, padrao] of ACOES) {
    if (padrao.test(norm)) {
      acao = nome;
      break;
    }
  }
  const termos = (norm.match(/[a-z0-9-]{2,}/g) ?? []).filter(
    (t) => !STOPWORDS.has(t),
  );
  const expandidos = [...termos];
  for (const t of termos) {
    for (const s of SINONIMOS[t] ?? []) {
      for (const st of normalizar(s).split(' ')) {
        if (!expandidos.includes(st) && !STOPWORDS.has(st)) expandidos.push(st);
      }
    }
  }
  return { acao, termos, termosExpandidos: expandidos };
}

function fonteDe(r: LinhaChunk): FonteEvidencia {
  return {
    arquivo: r.arquivo,
    linha: r.linha,
    versao: r.versao,
    referencia: r.referencia ?? '',
    tipo: r.tipo,
  };
}

function resumir(texto: string, tam: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= tam) return limpo;
  const corte = limpo.slice(0, tam);
  return `${corte.slice(0, corte.lastIndexOf(' '))} …`;
}

function fontesConsolidadas(achados: LinhaChunk[]): FonteEvidencia[] {
  const vistos = new Set<string>();
  const fontes: FonteEvidencia[] = [];
  for (const r of achados.slice(0, 40)) {
    const chave = `${r.arquivo}:${r.linha}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    fontes.push(fonteDe(r));
    if (fontes.length >= 20) break;
  }
  return fontes;
}

function sugestoes(interp: InterpretacaoPergunta): string[] {
  const tema = interp.termos.slice(0, 3).join(' ') || 'o assunto';
  const porAcao: Record<AcaoConsulta, string[]> = {
    funcionamento: [
      `quais parâmetros controlam ${tema}`,
      `quais cadastros são necessários para ${tema}`,
      `o que pode bloquear ${tema}`,
    ],
    configuracao: [
      `como funciona ${tema}`,
      `quais cadastros são necessários para ${tema}`,
      `quais validações existem em ${tema}`,
    ],
    cadastros: [`como configurar ${tema}`, `como funciona ${tema}`],
    diagnostico: [
      `como funciona ${tema}`,
      `quais parâmetros controlam ${tema}`,
      `quais validações existem em ${tema}`,
    ],
    processo: [
      `quais parâmetros controlam ${tema}`,
      `quais telas participam de ${tema}`,
    ],
  };
  return porAcao[interp.acao].slice(0, 4);
}
