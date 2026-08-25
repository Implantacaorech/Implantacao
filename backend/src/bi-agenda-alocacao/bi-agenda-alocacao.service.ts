import { Injectable } from '@nestjs/common';
import { DadosService } from '../dados/dados.service';
import { hojeIso } from '../cronograma/datas.util';
import { textoAparado } from '../common/utils/texto.util';
import {
  COR_STATUS_ALOCACAO,
  CompromissoHoras,
  DiaAlocacao,
  LinhaAlocacao,
  LinhaHorasAplicadas,
  ResumoStatusAlocacao,
  TotaisHorasAplicadas,
  normalizarLinhaAlocacao,
} from './bi-agenda-alocacao.constants';

export interface QueryCalendarioAlocacao {
  mes?: string;
  grupo?: string[];
  responsavel?: string[];
  tipoSuporte?: string[];
  status?: string[];
}

export interface FiltrosCalendarioAlocacao {
  grupos: string[];
  responsaveis: string[];
  tiposSuporte: string[];
  status: string[];
}

export interface ResultadoCalendarioAlocacao {
  mes: string;
  dias: DiaAlocacao[];
  resumo: ResumoStatusAlocacao[];
  /** Compromissos DISTINTOS visíveis (um mesmo `CODIGO` pode ter várias linhas, uma por
   * técnico) — é essa a contagem que bate com "quantas agendas" e não infla com
   * multiparticipação. */
  totalCompromissos: number;
  filtros: FiltrosCalendarioAlocacao;
  selecionados: FiltrosCalendarioAlocacao;
  erro: string | null;
}

export interface QueryHorasAplicadas {
  compIni?: string;
  compFim?: string;
  grupo?: string[];
  responsavel?: string[];
  tipoSuporte?: string[];
}

export interface FiltrosHorasAplicadas {
  grupos: string[];
  responsaveis: string[];
  tiposSuporte: string[];
}

export interface ResultadoHorasAplicadas {
  competencias: { inicio: string; fim: string };
  linhas: LinhaHorasAplicadas[];
  totais: TotaisHorasAplicadas;
  filtros: FiltrosHorasAplicadas;
  selecionados: FiltrosHorasAplicadas;
  erro: string | null;
}

/** Quantos meses o filtro de Horas Aplicadas cobre por padrão — mesmo valor de
 * `bi-indicadores.service.ts` (as duas telas dividem `compIni`/`compFim` no store do
 * frontend; manter o mesmo padrão evita um "salto" de janela ao trocar de subaba). */
const MESES_PADRAO_HORAS = 24;

/** "Alocação de Agendas" (aba **BI Implantação**) — Calendário de compromissos dos técnicos
 * e Horas Aplicadas por RNS de implantação. Duas origens de dado distintas (ver constants),
 * por isso um serviço só, mas sem estado/helpers compartilhados entre as duas páginas. */
@Injectable()
export class BiAgendaAlocacaoService {
  constructor(private readonly dados: DadosService) {}

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

  // ── Calendário ────────────────────────────────────────────────────────────────────

  private mesReferencia(mes?: string): {
    mes: string;
    ini: string;
    fim: string;
  } {
    const m = /^\d{4}-\d{2}$/.test((mes ?? '').trim())
      ? (mes as string).trim()
      : hojeIso().slice(0, 7);
    const [ano, num] = m.split('-').map(Number);
    const ini = `${m}-01`;
    const proximo =
      num === 12
        ? `${ano + 1}-01-01`
        : `${ano}-${String(num + 1).padStart(2, '0')}-01`;
    return { mes: m, ini, fim: proximo };
  }

  private vazioCalendario(
    mes: string,
    erro: string | null,
  ): ResultadoCalendarioAlocacao {
    const semFiltros: FiltrosCalendarioAlocacao = {
      grupos: [],
      responsaveis: [],
      tiposSuporte: [],
      status: [],
    };
    return {
      mes,
      dias: [],
      resumo: [],
      totalCompromissos: 0,
      filtros: semFiltros,
      selecionados: semFiltros,
      erro,
    };
  }

  async calendario(
    query: QueryCalendarioAlocacao,
  ): Promise<ResultadoCalendarioAlocacao> {
    const { mes, ini, fim } = this.mesReferencia(query.mes);
    // Sem checagem prévia de conexão: `consultar` já devolve {ok:false} com a mensagem que
    // diz onde configurar — uma fonte só para o mesmo aviso.
    const r = await this.dados.consultar('sicla.agenda.calendario', {
      mes_ini: ini,
      mes_fim: fim,
    });
    if (!r.ok) return this.vazioCalendario(mes, r.mensagem);

    const todas = r.linhas.map((l) => normalizarLinhaAlocacao(l));

    const preds = [
      {
        dimensao: 'grupo',
        ok: (a: LinhaAlocacao) => this.passa(query.grupo, a.grupoEconomico),
      },
      {
        dimensao: 'responsavel',
        ok: (a: LinhaAlocacao) => this.passa(query.responsavel, a.tecnico),
      },
      {
        dimensao: 'tipoSuporte',
        ok: (a: LinhaAlocacao) => this.passa(query.tipoSuporte, a.tipoSuporte),
      },
      {
        dimensao: 'status',
        ok: (a: LinhaAlocacao) => this.passa(query.status, a.status),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todas, preds, d);

    const filtros: FiltrosCalendarioAlocacao = {
      grupos: this.distintosDe(paraDim('grupo'), (a) => a.grupoEconomico),
      responsaveis: this.distintosDe(paraDim('responsavel'), (a) => a.tecnico),
      tiposSuporte: this.distintosDe(
        paraDim('tipoSuporte'),
        (a) => a.tipoSuporte,
      ),
      status: this.distintosDe(paraDim('status'), (a) => a.status),
    };

    const filtradas = todas.filter((a) => preds.every((p) => p.ok(a)));

    const [ano, num] = mes.split('-').map(Number);
    const diasNoMes = new Date(Date.UTC(ano, num, 0)).getUTCDate();
    const porDia = new Map<string, LinhaAlocacao[]>();
    for (const a of filtradas) {
      const lista = porDia.get(a.dia) ?? [];
      lista.push(a);
      porDia.set(a.dia, lista);
    }

    const dias: DiaAlocacao[] = [];
    for (let d = 1; d <= diasNoMes; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      const doDia = (porDia.get(iso) ?? []).sort((x, y) =>
        x.horaIni.localeCompare(y.horaIni),
      );
      dias.push({
        dia: iso,
        numero: d,
        diaSemana: new Date(`${iso}T00:00:00Z`).getUTCDay(),
        compromissos: doDia,
      });
    }

    const contagem = new Map<string, number>();
    for (const a of filtradas)
      contagem.set(a.status, (contagem.get(a.status) ?? 0) + 1);
    const total = filtradas.length;
    const resumo: ResumoStatusAlocacao[] = [...contagem.entries()]
      .map(([status, quantidade]) => ({
        status,
        quantidade,
        percentual:
          total > 0 ? Math.round((quantidade / total) * 1000) / 10 : 0,
        cor: COR_STATUS_ALOCACAO[status] ?? '#CCCCCC',
      }))
      .sort((a, b) => a.status.localeCompare(b.status));

    return {
      mes,
      dias,
      resumo,
      totalCompromissos: new Set(filtradas.map((a) => a.codigo)).size,
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        responsaveis: (query.responsavel ?? []).filter(Boolean),
        tiposSuporte: (query.tipoSuporte ?? []).filter(Boolean),
        status: (query.status ?? []).filter(Boolean),
      },
      erro: null,
    };
  }

  // ── Horas Aplicadas ──────────────────────────────────────────────────────────────

  private ehCompetencia(v: string | undefined): boolean {
    return /^\d{4}-\d{2}$/.test((v ?? '').trim());
  }

  private somaMeses(comp: string, n: number): string {
    const [ano, mes] = comp.split('-').map(Number);
    const t = ano * 12 + (mes - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
  }

  periodo(query: QueryHorasAplicadas): { inicio: string; fim: string } {
    const fim = this.ehCompetencia(query.compFim)
      ? (query.compFim as string).trim()
      : hojeIso().slice(0, 7);
    const inicio = this.ehCompetencia(query.compIni)
      ? (query.compIni as string).trim()
      : this.somaMeses(fim, -MESES_PADRAO_HORAS);
    return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio };
  }

  /** Duração em horas entre duas datas ISO (`DATAFIM - DATAINI`). O SQL já filtrou fora as
   * linhas sem uma das duas datas. */
  private horasEntre(iniIso: string, fimIso: string): number {
    const ini = Date.parse(iniIso);
    const fim = Date.parse(fimIso);
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return 0;
    return (fim - ini) / 3_600_000;
  }

  private normalizarCompromissoHoras(
    bruta: Record<string, unknown>,
  ): CompromissoHoras {
    const l: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;

    const horas = this.horasEntre(
      this.texto(l.DATA_INI),
      this.texto(l.DATA_FIM),
    );
    // Exatamente UMA das seis colunas vale 1 por linha (confirmado no banco); a ordem abaixo
    // segue a das medidas do BI (Encaminhada/Agendada/Realizada/NãoRealizada/Postergada/
    // Cancelada) e serve de desempate se algum dado vier sujo com mais de uma marcada.
    const flag =
      this.numero(l.ENCAMINHADA) === 1
        ? 'encaminhada'
        : this.numero(l.AGENDADA) === 1
          ? 'agendada'
          : this.numero(l.REALIZADA) === 1
            ? 'realizada'
            : this.numero(l.NAO_REALIZADA) === 1
              ? 'naoRealizada'
              : this.numero(l.POSTERGADA) === 1
                ? 'postergada'
                : this.numero(l.CANCELADA) === 1
                  ? 'cancelada'
                  : 'realizada'; // sem nenhuma marcada (não visto nos dados) — não perder a hora

    return {
      rns: l.RNS === null || l.RNS === undefined ? null : this.numero(l.RNS),
      horas,
      statusFlag: flag,
      fantasia: this.texto(l.FANTASIA),
      rnsDescricao: this.texto(l.RNS_DESCRICAO),
      responsavel: this.texto(l.RESPONSAVELDES),
      tipoSuporte: this.texto(l.TIPO_SUPORTE),
      grupoEconomico: this.texto(l.GRUPO_ECONOMICO),
    };
  }

  private totalizarHoras(linhas: LinhaHorasAplicadas[]): TotaisHorasAplicadas {
    const soma = (f: (l: LinhaHorasAplicadas) => number) =>
      this.arredondar(linhas.reduce((a, l) => a + f(l), 0));
    const total = soma((l) => l.horasTotal);
    const postergada = soma((l) => l.horasPostergada);
    return {
      rnsQuantidade: linhas.length,
      horasEncaminhada: soma((l) => l.horasEncaminhada),
      horasAgendada: soma((l) => l.horasAgendada),
      horasRealizada: soma((l) => l.horasRealizada),
      horasNaoRealizada: soma((l) => l.horasNaoRealizada),
      horasPostergada: postergada,
      horasCancelada: soma((l) => l.horasCancelada),
      horasTotal: total,
      percentualPostergada:
        total > 0 ? this.arredondar((postergada / total) * 100) : null,
    };
  }

  private vazioHoras(
    competencias: { inicio: string; fim: string },
    erro: string | null,
  ): ResultadoHorasAplicadas {
    const semFiltros: FiltrosHorasAplicadas = {
      grupos: [],
      responsaveis: [],
      tiposSuporte: [],
    };
    return {
      competencias,
      linhas: [],
      totais: this.totalizarHoras([]),
      filtros: semFiltros,
      selecionados: semFiltros,
      erro,
    };
  }

  async horasAplicadas(
    query: QueryHorasAplicadas,
  ): Promise<ResultadoHorasAplicadas> {
    const competencias = this.periodo(query);
    const r = await this.dados.consultar('sicla.agenda.horas-aplicadas', {
      data_ini: `${competencias.inicio}-01`,
      // Exclusivo — primeiro dia do mês SEGUINTE ao fim.
      data_fim: this.somaMeses(competencias.fim, 1) + '-01',
    });
    if (!r.ok) return this.vazioHoras(competencias, r.mensagem);

    const todos = r.linhas.map((l) => this.normalizarCompromissoHoras(l));

    const preds = [
      {
        dimensao: 'grupo',
        ok: (c: CompromissoHoras) => this.passa(query.grupo, c.grupoEconomico),
      },
      {
        dimensao: 'responsavel',
        ok: (c: CompromissoHoras) =>
          this.passa(query.responsavel, c.responsavel),
      },
      {
        dimensao: 'tipoSuporte',
        ok: (c: CompromissoHoras) =>
          this.passa(query.tipoSuporte, c.tipoSuporte),
      },
    ];
    const paraDim = (d: string) => this.emCascata(todos, preds, d);

    const filtros: FiltrosHorasAplicadas = {
      grupos: this.distintosDe(paraDim('grupo'), (c) => c.grupoEconomico),
      responsaveis: this.distintosDe(
        paraDim('responsavel'),
        (c) => c.responsavel,
      ),
      tiposSuporte: this.distintosDe(
        paraDim('tipoSuporte'),
        (c) => c.tipoSuporte,
      ),
    };

    const filtrados = todos.filter((c) => preds.every((p) => p.ok(c)));

    const porRns = new Map<number, CompromissoHoras[]>();
    for (const c of filtrados) {
      if (c.rns === null) continue; // sem RNS não entra na tabela por projeto
      const lista = porRns.get(c.rns) ?? [];
      lista.push(c);
      porRns.set(c.rns, lista);
    }

    const linhas: LinhaHorasAplicadas[] = [...porRns.entries()]
      .map(([rns, cs]) => {
        const soma = (flag: CompromissoHoras['statusFlag']) =>
          this.arredondar(
            cs
              .filter((c) => c.statusFlag === flag)
              .reduce((a, c) => a + c.horas, 0),
          );
        const encaminhada = soma('encaminhada');
        const agendada = soma('agendada');
        const realizada = soma('realizada');
        const naoRealizada = soma('naoRealizada');
        const postergada = soma('postergada');
        const cancelada = soma('cancelada');
        const total = this.arredondar(
          encaminhada +
            agendada +
            realizada +
            naoRealizada +
            postergada +
            cancelada,
        );
        return {
          rns,
          fantasia: cs[0].fantasia,
          rnsDescricao: cs[0].rnsDescricao,
          responsavel: cs[0].responsavel,
          tipoSuporte: cs[0].tipoSuporte,
          grupoEconomico: cs[0].grupoEconomico,
          qtdCompromissos: cs.length,
          horasEncaminhada: encaminhada,
          horasAgendada: agendada,
          horasRealizada: realizada,
          horasNaoRealizada: naoRealizada,
          horasPostergada: postergada,
          horasCancelada: cancelada,
          horasTotal: total,
          percentualPostergada:
            total > 0 ? this.arredondar((postergada / total) * 100) : null,
        };
      })
      .sort((a, b) => b.horasTotal - a.horasTotal);

    return {
      competencias,
      linhas,
      totais: this.totalizarHoras(linhas),
      filtros,
      selecionados: {
        grupos: (query.grupo ?? []).filter(Boolean),
        responsaveis: (query.responsavel ?? []).filter(Boolean),
        tiposSuporte: (query.tipoSuporte ?? []).filter(Boolean),
      },
      erro: null,
    };
  }
}
