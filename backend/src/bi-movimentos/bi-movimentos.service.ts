import { Injectable } from '@nestjs/common';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { hojeIso } from '../cronograma/datas.util';
import { textoAparado } from '../common/utils/texto.util';
import {
  ContagemMovimento,
  LinhaMovimentoAgrupado,
  MAX_MESES_JANELA_MOVIMENTOS,
  MESES_PADRAO_MOVIMENTOS,
  SQL_MOVIMENTOS_AGRUPADOS,
  TotaisMovimentos,
} from './bi-movimentos.constants';

export interface QueryMovimentos {
  dataIni?: string;
  dataFim?: string;
  tecnico?: string[];
  tpMovimento?: string[];
  cobraHora?: string[]; // 'Sim' | 'Não'
}

export interface FiltrosMovimentos {
  tecnicos: string[];
  tiposMovimento: string[];
}

export interface ResultadoMovimentos {
  periodo: { inicio: string; fim: string };
  /** Diz se o período pedido foi recortado para caber no teto de
   * `MAX_MESES_JANELA_MOVIMENTOS` — a tela avisa o usuário quando isso acontece. */
  periodoLimitado: boolean;
  porTecnico: ContagemMovimento[];
  porTpMovimento: ContagemMovimento[];
  totais: TotaisMovimentos;
  filtros: FiltrosMovimentos;
  selecionados: FiltrosMovimentos;
  erro: string | null;
}

/** "Movimentos de trabalho efetivo" (aba **BI Implantação**) — a única página do BI cujo SQL
 * já entrega AGRUPADO pelo Oracle, não linha a linha (ver bi-movimentos.constants.ts: a view
 * tem 663 mil linhas sem índice, buscar cru inviabilizaria a tela). O filtro/cascata que as
 * outras páginas fazem sobre as linhas cruas, esta faz sobre as ~400 linhas JÁ agregadas por
 * técnico × tipo de movimento × cobrança. */
@Injectable()
export class BiMovimentosService {
  constructor(private readonly disponibilidade: DisponibilidadeService) {}

  private numero(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private texto(v: unknown): string {
    return textoAparado(v);
  }

  private arredondar(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private passa(selecionados: string[] | undefined, valor: string): boolean {
    const sel = (selecionados ?? []).filter(Boolean);
    return sel.length === 0 || sel.includes(valor);
  }

  private distintosDe<T>(linhas: T[], campo: (l: T) => string): string[] {
    const s = new Set<string>();
    for (const l of linhas) {
      const v = campo(l);
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  private emCascata<T>(
    todas: T[],
    preds: { dimensao: string; ok: (l: T) => boolean }[],
    ignorada: string,
  ): T[] {
    return todas.filter((l) =>
      preds.every((p) => p.dimensao === ignorada || p.ok(l)),
    );
  }

  private ehDataIso(v: string | undefined): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test((v ?? '').trim());
  }

  private somaDias(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  private somaMeses(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  }

  /** Período com padrão de `MESES_PADRAO_MOVIMENTOS` meses e teto de
   * `MAX_MESES_JANELA_MOVIMENTOS` — ver bi-movimentos.constants.ts para o porquê do teto
   * (não é validação especulativa, é guarda contra uma consulta de minutos já medida). */
  periodo(query: QueryMovimentos): { inicio: string; fim: string; limitado: boolean } {
    const fimPedido = this.ehDataIso(query.dataFim)
      ? (query.dataFim as string).trim()
      : hojeIso();
    const inicioPedido = this.ehDataIso(query.dataIni)
      ? (query.dataIni as string).trim()
      : this.somaMeses(fimPedido, -MESES_PADRAO_MOVIMENTOS);
    const [inicio, fim] =
      inicioPedido <= fimPedido ? [inicioPedido, fimPedido] : [fimPedido, inicioPedido];
    const minimo = this.somaMeses(fim, -MAX_MESES_JANELA_MOVIMENTOS);
    const limitado = inicio < minimo;
    return { inicio: limitado ? minimo : inicio, fim, limitado };
  }

  private normalizar(bruta: Record<string, unknown>): LinhaMovimentoAgrupado {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;

    return {
      tecnico: this.texto(l.TECNICODES),
      tpMovimento: this.texto(l.TP_MOVIMENTO),
      cobraHora: this.texto(l.COBRA_HORA) === 'Sim',
      quantidade: this.numero(l.QTD),
      minutosTotal: this.numero(l.MIN_TOTAL),
      minutosCobrado: this.numero(l.MIN_COBRADO),
    };
  }

  private agregar(
    linhas: LinhaMovimentoAgrupado[],
    chave: (l: LinhaMovimentoAgrupado) => string,
  ): ContagemMovimento[] {
    const mapa = new Map<string, LinhaMovimentoAgrupado[]>();
    for (const l of linhas) {
      const k = chave(l) || '(sem informação)';
      const lista = mapa.get(k) ?? [];
      lista.push(l);
      mapa.set(k, lista);
    }
    return [...mapa.entries()]
      .map(([chave, ls]) => {
        const total = this.arredondar(
          ls.reduce((a, l) => a + l.minutosTotal, 0) / 60,
        );
        const cobradas = this.arredondar(
          ls.reduce((a, l) => a + l.minutosCobrado, 0) / 60,
        );
        return {
          chave,
          quantidade: ls.reduce((a, l) => a + l.quantidade, 0),
          horasTotal: total,
          horasCobradas: cobradas,
          horasNaoCobradas: this.arredondar(total - cobradas),
          percentualCobradas: total > 0 ? this.arredondar((cobradas / total) * 100) : null,
        };
      })
      .sort((a, b) => b.horasTotal - a.horasTotal);
  }

  private totalizar(linhas: LinhaMovimentoAgrupado[]): TotaisMovimentos {
    const total = this.arredondar(linhas.reduce((a, l) => a + l.minutosTotal, 0) / 60);
    const cobradas = this.arredondar(linhas.reduce((a, l) => a + l.minutosCobrado, 0) / 60);
    return {
      quantidade: linhas.reduce((a, l) => a + l.quantidade, 0),
      tecnicos: new Set(linhas.map((l) => l.tecnico).filter(Boolean)).size,
      horasTotal: total,
      horasCobradas: cobradas,
      horasNaoCobradas: this.arredondar(total - cobradas),
      percentualCobradas: total > 0 ? this.arredondar((cobradas / total) * 100) : null,
    };
  }

  private vazio(
    periodo: { inicio: string; fim: string; limitado: boolean },
    erro: string | null,
  ): ResultadoMovimentos {
    const semFiltros: FiltrosMovimentos = { tecnicos: [], tiposMovimento: [] };
    return {
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      periodoLimitado: periodo.limitado,
      porTecnico: [],
      porTpMovimento: [],
      totais: this.totalizar([]),
      filtros: semFiltros,
      selecionados: semFiltros,
      erro,
    };
  }

  async movimentos(query: QueryMovimentos): Promise<ResultadoMovimentos> {
    const periodo = this.periodo(query);
    if (!this.disponibilidade.configurado()) {
      return this.vazio(
        periodo,
        'Conexão com o SICLA não configurada ou inativa (Ferramentas → Disponibilidade).',
      );
    }

    const r = await this.disponibilidade.executarSql(
      SQL_MOVIMENTOS_AGRUPADOS,
      // O SQL já agrega no Oracle — o filtro de período é o único que precisa ir ao banco;
      // técnico/tipo de movimento/cobrança filtram em memória sobre o resultado agregado.
      { data_ini: periodo.inicio, data_fim: this.somaDias(periodo.fim, 1) },
      undefined,
      // Teto de segurança generoso: numa janela de 12 meses o agrupado já deu 431 linhas
      // (técnico × tipo de movimento × cobrança) — 2.000 cobre com folga sem repetir o
      // problema de escala que esta página existe para evitar.
      2000,
    );
    if (!r.ok) return this.vazio(periodo, r.mensagem);

    const todas = r.linhas.map((l) => this.normalizar(l));

    const preds = [
      { dimensao: 'tecnico', ok: (l: LinhaMovimentoAgrupado) => this.passa(query.tecnico, l.tecnico) },
      { dimensao: 'tpMovimento', ok: (l: LinhaMovimentoAgrupado) => this.passa(query.tpMovimento, l.tpMovimento) },
      {
        dimensao: 'cobraHora',
        ok: (l: LinhaMovimentoAgrupado) =>
          this.passa(query.cobraHora, l.cobraHora ? 'Sim' : 'Não'),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosMovimentos = {
      tecnicos: this.distintosDe(paraDim('tecnico'), (l) => l.tecnico),
      tiposMovimento: this.distintosDe(paraDim('tpMovimento'), (l) => l.tpMovimento),
    };

    const filtradas = todas.filter((l) => preds.every((p) => p.ok(l)));

    return {
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      periodoLimitado: periodo.limitado,
      porTecnico: this.agregar(filtradas, (l) => l.tecnico),
      porTpMovimento: this.agregar(filtradas, (l) => l.tpMovimento),
      totais: this.totalizar(filtradas),
      filtros,
      selecionados: {
        tecnicos: (query.tecnico ?? []).filter(Boolean),
        tiposMovimento: (query.tpMovimento ?? []).filter(Boolean),
      },
      erro: null,
    };
  }
}
