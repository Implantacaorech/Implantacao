import { Injectable, Logger } from '@nestjs/common';
import { ConsultaBD } from '../../database/entities/consulta-bd.entity';
import { ConsultaBdService } from '../consulta-bd.service';
import { CATALOGO } from './catalogo';
import {
  ChaveConexao,
  ConsultaCatalogo,
  ParametroConsulta,
} from './catalogo.types';

/** Menu exigido de um usuário do Painel (JWT) para chamar uma consulta criada pela TELA.
 * Quem publica a consulta é o Administrador, e é ele quem a enxerga por padrão — um token
 * de máquina continua alcançando-a pela autorização explícita, que é o caminho previsto. */
const MENU_CONSULTA_DE_TELA = 'consulta_bd';

/** Quanto tempo a lista mesclada fica em memória. Curto de propósito: publicar uma consulta
 * na tela precisa refletir rápido, e a montagem é barata (uma leitura de tabela pequena). */
const TTL_MS = 30_000;

/** CATÁLOGO EFETIVO — o de código MAIS as consultas publicadas pela tela.
 *
 * O catálogo em código (`catalogo.ts`) é o contrato revisado: nome, parâmetros e teto passam
 * por PR e por teste. As consultas de tela dão autonomia para publicar sem release, e por
 * isso são validadas na hora de salvar (ver `ConsultasPublicadasService`) e marcadas como
 * tal na documentação — quando algo dá errado, "revisada ou de tela?" é a primeira pergunta.
 *
 * Em conflito de nome, **o código vence**: uma consulta de tela não pode sequestrar um nome
 * do contrato revisado. */
@Injectable()
export class CatalogoService {
  private readonly logger = new Logger('CatalogoService');
  private cache: { ts: number; itens: ConsultaCatalogo[] } | null = null;

  constructor(private readonly salvas: ConsultaBdService) {}

  /** Descarta o cache — chamado ao publicar, editar ou despublicar uma consulta. */
  invalidar(): void {
    this.cache = null;
  }

  async listar(): Promise<ConsultaCatalogo[]> {
    const agora = Date.now();
    if (this.cache && agora - this.cache.ts < TTL_MS) return this.cache.itens;

    let deTela: ConsultaCatalogo[] = [];
    try {
      const linhas = await this.salvas.listar();
      const nomesDeCodigo = new Set(CATALOGO.map((c) => c.nome));
      deTela = linhas
        .filter((l) => l.publicada && (l.nomeApi || '').trim())
        .map((l) => this.converter(l))
        .filter((c): c is ConsultaCatalogo => c !== null)
        .filter((c) => !nomesDeCodigo.has(c.nome));
    } catch (e) {
      // Banco fora não pode derrubar o catálogo: as consultas de CÓDIGO continuam valendo.
      this.logger.error(
        `Falha ao ler as consultas publicadas; catálogo segue só com as de código: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    const itens = [...CATALOGO, ...deTela];
    this.cache = { ts: agora, itens };
    return itens;
  }

  async porNome(nome: string): Promise<ConsultaCatalogo | undefined> {
    const alvo = (nome || '').trim();
    if (!alvo) return undefined;
    return (await this.listar()).find((c) => c.nome === alvo);
  }

  /** Nomes de todas as consultas efetivas — é o universo que um token pode autorizar. */
  async nomes(): Promise<string[]> {
    return (await this.listar()).map((c) => c.nome).sort();
  }

  /** Linha de `consultas_bd` → entrada de catálogo. Devolve `null` quando a linha está
   * incompleta: publicar sem teto ou sem conexão válida seria pior que não publicar. */
  private converter(l: ConsultaBD): ConsultaCatalogo | null {
    const conexao: ChaveConexao =
      l.conexao === 'portal' ? 'portal_rech' : 'sicla';
    if (l.limiteLinhas <= 0) return null;

    return {
      nome: l.nomeApi.trim(),
      titulo: l.nome || l.nomeApi,
      descricao:
        `Consulta criada em Sistema → Consultas BD (slug \`${l.slug}\`). ` +
        'Publicada pelo Administrador, sem revisão de código.',
      conexao,
      menus: [MENU_CONSULTA_DE_TELA],
      parametros: this.lerParametros(l.parametros),
      origem: { tipo: 'tela', slug: l.slug },
      limiteLinhas: l.limiteLinhas,
      cacheSegundos: Math.max(0, l.cacheSegundos),
      donoAtual: 'tela (Consultas BD)',
      desde: 'v1',
    };
  }

  private lerParametros(json: string | null): ParametroConsulta[] {
    if (!json?.trim()) return [];
    try {
      const bruto: unknown = JSON.parse(json);
      return Array.isArray(bruto) ? (bruto as ParametroConsulta[]) : [];
    } catch {
      // JSON corrompido vira "sem parâmetro": a consulta ainda roda se o SQL não usar bind,
      // e falha com mensagem clara se usar. Melhor que derrubar o catálogo inteiro.
      return [];
    }
  }
}
