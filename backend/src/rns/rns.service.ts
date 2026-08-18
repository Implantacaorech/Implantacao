import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import {
  addDays,
  ehDataIso,
  hojeIso,
  parseIso,
  toIso,
} from '../cronograma/datas.util';
import {
  LIMITE_CONSULTA_RNS,
  LinhaRns,
  NOME_CONSULTA_RNS,
  SLUG_CONSULTA_RNS,
  SQL_CONSULTA_RNS_PADRAO,
  normalizarLinhaRns,
} from './rns.constants';

export interface QueryConsultaRns {
  ini?: string;
  fim?: string;
}

export interface ResultadoConsultaRns {
  ini: string;
  fim: string;
  /** As RNS do período, já na ordem de backlog/prioridade do SICLA (ORDER BY do SQL). */
  itens: LinhaRns[];
  total: number;
  limite: number;
  /** A consulta bateu no teto de linhas — há mais RNS no período do que o que veio. */
  truncado: boolean;
  erro: string | null;
}

/** Maior janela de criação aceita numa chamada — um ano dá busca histórica generosa sem
 * deixar uma requisição varrer a view inteira. */
export const MAX_DIAS_JANELA_RNS = 366;

export interface ResultadoDetalheRns {
  /** O número da RNS pedido (PEDIDO em `LISTA_ITEMPED`). */
  numero: number;
  /** TODOS os itens do pedido, em ordem de item — o "resumo completo" da RNS. */
  itens: LinhaRns[];
  total: number;
  erro: string | null;
}

/** Teto de linhas do detalhe de UM pedido — um pedido tem poucos itens; o teto só protege
 * contra um SQL editado que perca o filtro. */
export const LIMITE_DETALHE_RNS = 200;

/** O detalhe busca por NÚMERO, sem janela de criação — a RNS clicada no calendário pode ser
 * mais antiga que qualquer janela. Se o SQL vigente referencia os binds de data, eles são
 * supridos com este intervalo total para o filtro de período não esconder a RNS. */
const JANELA_TOTAL = { ini: '1900-01-01', fim: '2999-12-31' };

/** Tela **Execução → RNS** — o consultor pesquisa um assunto e vê as RNS relacionadas
 * (Pedido + Item), no molde do Dicionário Inteligente. O backend entrega o PERÍODO inteiro
 * (janela de `DATACRI`); a busca por assunto e os filtros são aplicados NA TELA, em memória
 * — mesmo idioma da Agenda e dos BIs, para cada tecla digitada não custar uma ida ao SICLA.
 *
 * O SQL vive no **Consultas BD** (Sistema → Consulta BD, slug `rns_lista_itemped`):
 * semeado no boot com o default embutido e editável pelo Administrador sem deploy — mesmo
 * desenho da `lista_tecnicos_sicla` do cadastro de Usuários. */
@Injectable()
export class RnsService implements OnModuleInit {
  private readonly logger = new Logger('RnsService');

  constructor(
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
  ) {}

  /** Semeia o SQL (idempotente) para o Administrador editar na tela de Consultas BD.
   * Não sobrescreve se já existir — respeita edição manual. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_CONSULTA_RNS);
      if (!existe) {
        await this.consultas.salvar(SLUG_CONSULTA_RNS, {
          nome: NOME_CONSULTA_RNS,
          sql: SQL_CONSULTA_RNS_PADRAO,
          ordem: 95,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        'Falha ao semear a consulta de RNS (LISTA_ITEMPED) no Consultas BD',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** SQL vigente: a versão editada pelo Administrador no Consultas BD, ou o default. */
  private async sqlConsulta(): Promise<string> {
    const c = await this.consultas.porSlug(SLUG_CONSULTA_RNS);
    const sql = (c?.sql ?? '').trim();
    return sql || SQL_CONSULTA_RNS_PADRAO;
  }

  /** Janela [ini, fim] saneada. Default = do 1º dia do mês ANTERIOR ao último dia do mês
   * SEGUINTE (a janela da consulta original: em agosto, 01/07 → 30/09 — pega o backlog
   * recente e o previsto). Invertida vira ordenada; mais larga que `MAX_DIAS_JANELA_RNS`
   * é aparada pelo fim. */
  periodo(query: QueryConsultaRns): { ini: string; fim: string } {
    let ini = ehDataIso(query.ini ?? '') ? (query.ini as string) : '';
    let fim = ehDataIso(query.fim ?? '') ? (query.fim as string) : '';
    const hoje = parseIso(hojeIso());
    if (!ini) {
      ini = toIso(
        new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1)),
      );
    }
    if (!fim) {
      // `dia 0` do mês m+2 = último dia do mês m+1 — o "mês seguinte" fechado.
      fim = toIso(
        new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 2, 0)),
      );
    }
    if (ini > fim) [ini, fim] = [fim, ini];
    const teto = toIso(addDays(parseIso(ini), MAX_DIAS_JANELA_RNS - 1));
    return { ini, fim: fim > teto ? teto : fim };
  }

  private vazio(
    ini: string,
    fim: string,
    erro: string | null,
  ): ResultadoConsultaRns {
    return {
      ini,
      fim,
      itens: [],
      total: 0,
      limite: LIMITE_CONSULTA_RNS,
      truncado: false,
      erro,
    };
  }

  async consultar(query: QueryConsultaRns): Promise<ResultadoConsultaRns> {
    const { ini, fim } = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazio(
        ini,
        fim,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    // Só passa os binds que o SQL vigente referencia: o Administrador pode ter colado uma
    // versão com datas fixas (sem :data_ini/:data_fim) e bind sobrando derruba o Oracle
    // com ORA-01036 — a tela apenas perde o filtro de período, o que é o esperado.
    const sql = await this.sqlConsulta();
    const binds: Record<string, string> = {};
    if (/:data_ini\b/.test(sql)) binds.data_ini = ini;
    if (/:data_fim\b/.test(sql)) binds.data_fim = fim;

    const r = await this.disponibilidade.executarSql(
      sql,
      binds,
      undefined,
      LIMITE_CONSULTA_RNS,
    );
    if (!r.ok) return this.vazio(ini, fim, r.mensagem);

    const itens = r.linhas.map((l) => normalizarLinhaRns(l));
    return {
      ini,
      fim,
      itens,
      total: itens.length,
      limite: LIMITE_CONSULTA_RNS,
      truncado: itens.length >= LIMITE_CONSULTA_RNS,
      erro: null,
    };
  }

  /** Resumo completo de UMA RNS (todos os itens do pedido) — aberto pelo clique num
   * compromisso do calendário da Agenda. Embrulha o SQL vigente do Consultas BD numa
   * inline view filtrada por `PEDIDO`: o contrato de colunas (e qualquer correção de
   * schema feita pelo Administrador) vale aqui também, sem duplicar a consulta. */
  async detalhar(numero: number): Promise<ResultadoDetalheRns> {
    const vazio = (erro: string | null): ResultadoDetalheRns => ({
      numero,
      itens: [],
      total: 0,
      erro,
    });
    if (!Number.isInteger(numero) || numero <= 0) {
      return vazio('Número de RNS inválido.');
    }
    if (!this.disponibilidade.configurado()) {
      return vazio(
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const base = await this.sqlConsulta();
    // ORDER BY externo por ITEM: a ordem de backlog do SQL interno não faz sentido dentro
    // de um único pedido — a ficha lista item 1, 2, 3…
    const sql = `SELECT * FROM (\n${base}\n) WHERE PEDIDO = :pedido ORDER BY ITEM`;
    const binds: Record<string, string | number> = { pedido: numero };
    if (/:data_ini\b/.test(base)) binds.data_ini = JANELA_TOTAL.ini;
    if (/:data_fim\b/.test(base)) binds.data_fim = JANELA_TOTAL.fim;

    const r = await this.disponibilidade.executarSql(
      sql,
      binds,
      undefined,
      LIMITE_DETALHE_RNS,
    );
    if (!r.ok) return vazio(r.mensagem);

    const itens = r.linhas.map((l) => normalizarLinhaRns(l));
    if (itens.length === 0) {
      return vazio(`A RNS ${numero} não foi encontrada no SICLA.`);
    }
    return { numero, itens, total: itens.length, erro: null };
  }
}
