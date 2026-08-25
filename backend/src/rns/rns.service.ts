import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
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
 * Pede `sicla.rns.listar` e `sicla.rns.detalhar` à API de Dados (ADR-0003). O SQL continua
 * editável pelo Administrador em Consultas BD (slug `rns_lista_itemped`) — mas quem resolve
 * o texto vigente, os binds e o teto é o catálogo, não este módulo. */
@Injectable()
export class RnsService {
  constructor(private readonly dados: DadosService) {}

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
    // Descartar o bind que o SQL vigente não cita (o Administrador pode ter colado uma
    // versão com datas fixas, e bind sobrando derruba o Oracle com ORA-01036) virou
    // responsabilidade do catálogo. Aqui só se informa a janela pedida.
    const r = await this.dados.consultar('sicla.rns.listar', {
      data_ini: ini,
      data_fim: fim,
    });
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
   * compromisso do calendário da Agenda.
   *
   * O recorte por `PEDIDO` (a inline view com `ORDER BY ITEM`) mora no catálogo, no
   * `envelopar` da consulta `sicla.rns.detalhar`: assim a ficha herda o contrato de colunas
   * e qualquer correção de schema feita no SQL base, sem duplicar a consulta. */
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

    const r = await this.dados.consultar('sicla.rns.detalhar', {
      pedido: numero,
      data_ini: JANELA_TOTAL.ini,
      data_fim: JANELA_TOTAL.fim,
    });
    if (!r.ok) return vazio(r.mensagem);

    const itens = r.linhas.map((l) => normalizarLinhaRns(l));
    if (itens.length === 0) {
      return vazio(`A RNS ${numero} não foi encontrada no SICLA.`);
    }
    return { numero, itens, total: itens.length, erro: null };
  }
}
