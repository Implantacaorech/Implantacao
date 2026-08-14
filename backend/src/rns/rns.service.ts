import { Injectable } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { addDays, ehDataIso, hojeIso, parseIso, toIso } from '../cronograma/datas.util';
import {
  LIMITE_CONSULTA_RNS,
  LinhaRns,
  SQL_CONSULTA_RNS,
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

/** Tela **Execução → RNS** — o consultor pesquisa um assunto e vê as RNS relacionadas
 * (Pedido + Item), no molde do Dicionário Inteligente. O backend entrega o PERÍODO inteiro
 * (janela de `DATACRI`); a busca por assunto e os filtros são aplicados NA TELA, em memória
 * — mesmo idioma da Agenda e dos BIs, para cada tecla digitada não custar uma ida ao SICLA. */
@Injectable()
export class RnsService {
  constructor(private readonly disponibilidade: DisponibilidadeService) {}

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

    const r = await this.disponibilidade.executarSql(
      SQL_CONSULTA_RNS,
      { data_ini: ini, data_fim: fim },
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
}
