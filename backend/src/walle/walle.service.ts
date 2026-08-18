import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { WalleArquivo } from '../database/entities/walle-arquivo.entity';
import { WalleChat } from '../database/entities/walle-chat.entity';
import { IndexacaoWalleService, ResumoSincronizacao } from './indexacao-walle.service';
import { AcervoFsRepository } from './repositories/acervo-fs.repository';
import { WalleArquivosRepository } from './repositories/walle-arquivos.repository';
import { WalleChatsRepository } from './repositories/walle-chats.repository';
import { WalleEntidadesRepository } from './repositories/walle-entidades.repository';
import { CoberturaOracle, WalleOracleService } from './walle-oracle.service';
import { ehImagem } from './texto-walle.util';

export interface StatusAcervo {
  dirAcervo: string;
  fonteDisponivel: boolean;
  chats: number;
  arquivos: number;
  ultimaAtualizacao: string | null;
  ultimoResumo: ResumoSincronizacao | null;
  oracle: CoberturaOracle | null;
  /** Limitações da base, sempre visíveis (§37) — a tela exibe como está. */
  limitacoes: string;
}

export interface VisaoChat {
  chat: WalleChat;
  arquivos: Array<Omit<WalleArquivo, 'conteudo'>>;
  assuntos: string[];
  entidades: Array<{ tipo: string; valor: string }>;
  relacionados: Array<{ codigo: number; descricao: string; motivo: string }>;
}

const LIMITACOES_BASE =
  'O acervo documental representa apenas os chats que produziram ou receberam arquivos — ' +
  'nem todo chat tem pasta, nem todo diálogo tem arquivo, e a conversa completa vive no ' +
  'Oracle do SICLA. Alguns arquivos são insumos (logs, imagens), não conclusões do Wall-e.';

/** Fachada do módulo Consulta Wall-e: status/atualização do acervo e a visão completa de
 * um chat (§21). A fonte `R:\GRM\CHAT_WALLE\` é SOMENTE LEITURA — toda escrita deste
 * módulo acontece nas tabelas `walle_*` do banco do Painel. */
@Injectable()
export class WalleService implements OnModuleInit {
  private readonly logger = new Logger(WalleService.name);
  private ultimaAtualizacao: Date | null = null;
  private ultimoResumo: ResumoSincronizacao | null = null;
  private ultimaCoberturaOracle: CoberturaOracle | null = null;

  constructor(
    private readonly fonte: AcervoFsRepository,
    private readonly arquivos: WalleArquivosRepository,
    private readonly chats: WalleChatsRepository,
    private readonly entidades: WalleEntidadesRepository,
    private readonly indexacao: IndexacaoWalleService,
    private readonly oracle: WalleOracleService,
  ) {}

  /** Primeira indexação automática quando o índice está vazio — em segundo plano, para não
   * atrasar o boot; falha vira log, nunca derruba o app. Nada roda em teste. */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    setImmediate(() => {
      void (async () => {
        try {
          if ((await this.arquivos.contarAtivos()) === 0 && this.fonte.disponivel()) {
            this.logger.log('Índice do acervo Wall-e vazio — indexação inicial.');
            await this.atualizar();
          }
        } catch (e) {
          this.logger.error(`Indexação inicial do acervo Wall-e falhou: ${String(e)}`);
        }
      })();
    });
  }

  async status(): Promise<StatusAcervo> {
    return {
      dirAcervo: this.fonte.raiz(),
      fonteDisponivel: this.fonte.disponivel(),
      chats: await this.chats.contar(),
      arquivos: await this.arquivos.contarAtivos(),
      ultimaAtualizacao: this.ultimaAtualizacao?.toISOString() ?? null,
      ultimoResumo: this.ultimoResumo,
      oracle: this.ultimaCoberturaOracle,
      limitacoes: LIMITACOES_BASE,
    };
  }

  /** "Atualizar acervo" (§36): sincroniza o índice com a fonte e tenta enriquecer os
   * metadados pelo SICLA. O enriquecimento é best-effort — SICLA fora não invalida a
   * sincronização do acervo. */
  async atualizar(): Promise<StatusAcervo> {
    this.ultimoResumo = await this.indexacao.sincronizar();
    this.ultimaAtualizacao = new Date();
    try {
      this.ultimaCoberturaOracle = await this.oracle.enriquecer();
    } catch (e) {
      this.ultimaCoberturaOracle = {
        disponivel: false,
        mensagem: `Enriquecimento SICLA falhou: ${String(e)}`,
        chatsOracle: null,
        enriquecidos: 0,
      };
    }
    return this.status();
  }

  async listarChats(): Promise<WalleChat[]> {
    return this.chats.todos();
  }

  /** Visão completa de um chat (§21): metadados + arquivos + assuntos + entidades +
   * chats relacionados por entidade compartilhada (§14). */
  async visaoChat(codigo: number): Promise<VisaoChat> {
    const chat = await this.chats.porCodigo(codigo);
    if (!chat) {
      throw new NotFoundException(`Chat ${codigo} não existe no acervo indexado.`);
    }
    const arquivos = await this.arquivos.porChat(codigo);
    const entidades = await this.entidades.porChat(codigo);

    const assuntos = new Set<string>();
    for (const a of arquivos) {
      for (const s of a.assuntos.split(' ')) if (s) assuntos.add(s);
    }

    const minhas = new Set(
      entidades
        .filter((e) => ['rns', 'ficha', 'tabela', 'repositorio', 'erro'].includes(e.tipo))
        .map((e) => `${e.tipo}:${e.valor}`),
    );
    const relacionados: VisaoChat['relacionados'] = [];
    if (minhas.size > 0) {
      const todas = await this.entidades.todas();
      const vistos = new Set<number>();
      for (const e of todas) {
        if (e.chatCodigo === codigo || vistos.has(e.chatCodigo)) continue;
        if (minhas.has(`${e.tipo}:${e.valor}`)) {
          vistos.add(e.chatCodigo);
          const outro = await this.chats.porCodigo(e.chatCodigo);
          relacionados.push({
            codigo: e.chatCodigo,
            descricao: outro?.descricao ?? '',
            motivo: `Compartilha ${e.tipo} ${e.valor}.`,
          });
        }
      }
    }

    return {
      chat,
      arquivos: arquivos.map(({ conteudo: _conteudo, ...resto }) => resto),
      assuntos: [...assuntos],
      entidades: entidades.map((e) => ({ tipo: e.tipo, valor: e.valor })),
      relacionados,
    };
  }

  /** Documento completo (conteúdo textual extraído + contexto do card). */
  async arquivo(id: number): Promise<WalleArquivo> {
    const a = await this.arquivos.porId(id);
    if (!a) throw new NotFoundException(`Arquivo ${id} não existe no acervo indexado.`);
    return a;
  }

  /** Bytes de uma imagem do acervo, lidos da FONTE (somente leitura) na hora — imagens não
   * são copiadas para o banco. §20: exibir sem jamais alterar o original. */
  async imagem(id: number): Promise<{ dados: Buffer; mime: string; nome: string }> {
    const a = await this.arquivo(id);
    if (!ehImagem(a.extensao)) {
      throw new NotFoundException(`Arquivo ${id} não é uma imagem.`);
    }
    const dados = this.fonte.ler(a.caminhoRelativo);
    if (dados === null) {
      throw new NotFoundException(
        'Imagem indisponível — a fonte do acervo não está acessível no momento.',
      );
    }
    const mime = a.extensao === 'png' ? 'image/png' : `image/${a.extensao === 'jpg' ? 'jpeg' : a.extensao}`;
    return { dados, mime, nome: a.nome };
  }
}
