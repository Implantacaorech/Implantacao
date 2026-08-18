import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { AcervoFsRepository, ArquivoFonte } from './repositories/acervo-fs.repository';
import { WalleArquivosRepository } from './repositories/walle-arquivos.repository';
import { WalleChatsRepository } from './repositories/walle-chats.repository';
import { WalleEntidadesRepository } from './repositories/walle-entidades.repository';
import {
  classificar,
  decodificarTexto,
  detectarOrigem,
  ehTexto,
  extrairAssuntos,
  extrairEntidades,
  extrairResumo,
  extrairTitulo,
} from './texto-walle.util';

/** Resultado de uma sincronização — alimenta a função "Atualizar acervo" (§36). */
export interface ResumoSincronizacao {
  disponivel: boolean;
  mensagem: string;
  chats: number;
  arquivos: number;
  novos: number;
  alterados: number;
  removidos: number;
  inalterados: number;
  duracaoMs: number;
}

// Acima disso o arquivo não tem o conteúdo extraído (indexa só nome/metadados) — protege a
// indexação de um log gigante; o acervo real hoje tem 20 arquivos somando 0,9 MB.
const MAX_BYTES_CONTEUDO = 5 * 1024 * 1024;

/** Indexação INCREMENTAL do acervo `R:\GRM\CHAT_WALLE\` para as tabelas `walle_*`.
 *
 * A fonte é SOMENTE LEITURA — este service lê via `AcervoFsRepository` e grava
 * exclusivamente no banco do Painel. O controle incremental é externo à fonte (§35):
 * tamanho+mtime como fast-path, SHA-256 do conteúdo como decisão final. Arquivo que sumiu
 * vira `removido = true` (nunca se apaga o histórico); se voltar, reativa. */
@Injectable()
export class IndexacaoWalleService {
  private readonly logger = new Logger(IndexacaoWalleService.name);

  constructor(
    private readonly fonte: AcervoFsRepository,
    private readonly arquivos: WalleArquivosRepository,
    private readonly chats: WalleChatsRepository,
    private readonly entidades: WalleEntidadesRepository,
  ) {}

  async sincronizar(): Promise<ResumoSincronizacao> {
    const inicio = Date.now();
    const zerado = {
      chats: 0,
      arquivos: 0,
      novos: 0,
      alterados: 0,
      removidos: 0,
      inalterados: 0,
    };
    if (!this.fonte.disponivel()) {
      return {
        disponivel: false,
        mensagem:
          `Acervo indisponível: a pasta ${this.fonte.raiz()} não está acessível ` +
          '(share de rede fora do ar?). O índice existente continua valendo.',
        ...zerado,
        duracaoMs: Date.now() - inicio,
      };
    }

    const naFonte = this.fonte.listar();
    const indexados = new Map(
      (await this.arquivos.todos()).map((a) => [a.caminhoRelativo, a]),
    );

    let novos = 0;
    let alterados = 0;
    let inalterados = 0;

    for (const f of naFonte) {
      const existente = indexados.get(f.caminhoRelativo);
      indexados.delete(f.caminhoRelativo);
      if (
        existente &&
        !existente.removido &&
        existente.tamanhoBytes === f.tamanhoBytes &&
        existente.modificadoEm?.getTime() === f.modificadoEm.getTime()
      ) {
        inalterados++;
        continue; // fast-path: nem lê o arquivo
      }
      const salvo = await this.indexarArquivo(f, existente ?? null);
      if (salvo === 'novo') novos++;
      else if (salvo === 'alterado') alterados++;
      else inalterados++;
    }

    // O que restou no mapa não está mais na fonte — marca removido (preserva o histórico).
    let removidos = 0;
    for (const orfao of indexados.values()) {
      if (orfao.removido) continue;
      await this.arquivos.marcarRemovido(orfao.id);
      await this.entidades.removerDoArquivo(orfao.id);
      removidos++;
    }

    await this.consolidarChats(naFonte);

    const totalChats = await this.chats.contar();
    const totalArquivos = await this.arquivos.contarAtivos();
    this.logger.log(
      `Acervo Wall-e sincronizado: ${totalArquivos} arquivo(s) em ${totalChats} chat(s) — ` +
        `${novos} novo(s), ${alterados} alterado(s), ${removidos} removido(s).`,
    );
    return {
      disponivel: true,
      mensagem: 'Base atualizada.',
      chats: totalChats,
      arquivos: totalArquivos,
      novos,
      alterados,
      removidos,
      inalterados,
      duracaoMs: Date.now() - inicio,
    };
  }

  /** Lê, extrai e grava UM arquivo. Devolve o que aconteceu (para o placar do §36). */
  private async indexarArquivo(
    f: ArquivoFonte,
    existente: WalleArquivo | null,
  ): Promise<'novo' | 'alterado' | 'inalterado'> {
    const bruto = this.fonte.ler(f.caminhoRelativo);
    if (bruto === null) return 'inalterado'; // travou entre listar e ler — próxima sync pega

    const hash = createHash('sha256').update(bruto).digest('hex');
    if (existente && existente.hashConteudo === hash && !existente.removido) {
      // mtime mudou mas o conteúdo não (cópia/restauração) — só atualiza os metadados.
      await this.arquivos.salvar({
        id: existente.id,
        modificadoEm: f.modificadoEm,
        tamanhoBytes: f.tamanhoBytes,
      });
      return 'inalterado';
    }

    const textual = ehTexto(f.extensao) && bruto.length <= MAX_BYTES_CONTEUDO;
    const conteudo = textual ? decodificarTexto(bruto) : '';
    const titulo = extrairTitulo(conteudo, f.nome, f.extensao);
    const entidades = textual ? extrairEntidades(conteudo) : [];
    const salvo = await this.arquivos.salvar({
      ...(existente ? { id: existente.id } : {}),
      caminhoRelativo: f.caminhoRelativo,
      chatCodigo: f.chatCodigo,
      nome: f.nome,
      extensao: f.extensao,
      categoria: classificar(f.nome, f.extensao, conteudo),
      origem: detectarOrigem(f.extensao, conteudo),
      titulo,
      resumo: extrairResumo(conteudo, f.extensao),
      conteudo,
      assuntos: extrairAssuntos(titulo, conteudo, entidades).join(' '),
      tamanhoBytes: f.tamanhoBytes,
      modificadoEm: f.modificadoEm,
      hashConteudo: hash,
      removido: false,
    });
    await this.entidades.substituirDoArquivo(
      salvo.id,
      entidades.map((e) => ({ chatCodigo: f.chatCodigo, ...e })),
    );
    return existente ? 'alterado' : 'novo';
  }

  /** Recalcula o placar por chat. Metadados vindos do Oracle (descrição/técnico/sistema)
   * são preservados — a sincronização do acervo só mexe no que é do acervo. */
  private async consolidarChats(naFonte: ArquivoFonte[]): Promise<void> {
    const porChat = new Map<number, ArquivoFonte[]>();
    for (const f of naFonte) {
      const lista = porChat.get(f.chatCodigo) ?? [];
      lista.push(f);
      porChat.set(f.chatCodigo, lista);
    }
    for (const [codigo, lista] of porChat) {
      const existente = await this.chats.porCodigo(codigo);
      const ultimo = lista.reduce(
        (max, f) => (f.modificadoEm > max ? f.modificadoEm : max),
        lista[0].modificadoEm,
      );
      await this.chats.salvar({
        ...(existente ? { id: existente.id } : {}),
        codigo,
        totalArquivos: lista.length,
        ultimoArquivoEm: ultimo,
      });
    }
    // Chat cuja pasta sumiu (ou ficou vazia) zera o placar — sem inventar presença.
    for (const c of await this.chats.todos()) {
      if (!porChat.has(c.codigo) && c.totalArquivos !== 0) {
        await this.chats.salvar({ id: c.id, codigo: c.codigo, totalArquivos: 0 });
      }
    }
  }
}
