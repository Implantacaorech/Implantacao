import { Injectable } from '@nestjs/common';
import { ConsultaBdService } from './consulta-bd.service';
import { DisponibilidadeService } from './disponibilidade.service';
import { PortalDbService } from './portal-db.service';
import { hojeIso } from '../cronograma/datas.util';
import { textoAparado } from '../common/utils/texto.util';

const MESES_PT = [
  '',
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export interface Periodo {
  ref: string; // AAAA-MM
  direcao: 'avancar' | 'recuar';
  n: number;
  inicio: string; // AAAA-MM-DD, inclusivo
  fimExclusivo: string; // AAAA-MM-DD
  fim: string; // AAAA-MM-DD, inclusivo (fimExclusivo - 1 dia)
}

export interface MesPeriodo {
  ano: number;
  mes: number;
  nome: string;
}

export interface QueryDashboard {
  ref?: string;
  direcao?: string;
  n?: string | number;
  situacao?: string[];
  mesSel?: string | number;
  anoSel?: string | number;
}

export interface ResultadoDashboard {
  slug: string;
  nome: string;
  periodo: Periodo;
  meses: MesPeriodo[];
  atalhos: Record<number, number>;
  mesSel: number | null;
  anoSel: number | null;
  situacoesDisponiveis: string[];
  situacoesSelecionadas: string[];
  linhasTabela: Record<string, unknown>[];
  grafico: { labels: string[]; valores: number[] } | null;
  totalPeriodo: number;
  erro: string | null;
}

/** Aba Dashboards (`/dashboards`) — análises lidas das "Consultas BD", rodadas contra a
 * conexão externa configurada em Disponibilidade. Espelha webapp/routes_dashboards.py,
 * generalizado (decisão tomada com o usuário — ver `ConsultaBD.colunaData`/
 * `colunaSituacao`/`mostrarGrafico` e docs/migracao/03-documento-conversao.md): o Flask
 * original só implementava de verdade UMA análise, com essas duas colunas hardcoded no
 * Python; aqui qualquer consulta salva com `colunaData` preenchida vira um dashboard. */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly consultas: ConsultaBdService,
    private readonly disponibilidade: DisponibilidadeService,
    private readonly portalDb: PortalDbService,
  ) {}

  private addMonths(iso: string, n: number): string {
    const [ano, mes] = iso.split('-').map(Number);
    const m = mes - 1 + n;
    const y = ano + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    return `${y}-${String(mm + 1).padStart(2, '0')}-01`;
  }

  private addDays(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /** Calcula o período do filtro (início inclusivo, fim exclusivo) a partir de `ref`
   * (AAAA-MM, padrão = mês atual), `direcao` (avancar|recuar, padrão avancar) e `n`
   * (padrão 12). Espelha webapp/routes_dashboards.py:_periodo. */
  periodo(query: QueryDashboard): Periodo {
    const hoje = hojeIso();
    let refIni = `${hoje.slice(0, 7)}-01`;
    const refRaw = (query.ref || '').trim();
    if (/^\d{4}-\d{1,2}$/.test(refRaw)) {
      const [ano, mes] = refRaw.split('-').map(Number);
      if (mes >= 1 && mes <= 12)
        refIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
    }
    const direcao = query.direcao === 'recuar' ? 'recuar' : 'avancar';
    let n = Number(query.n ?? 12);
    if (!Number.isFinite(n)) n = 12;
    n = Math.max(1, Math.min(60, Math.trunc(n)));

    let inicio: string;
    let fimExclusivo: string;
    if (direcao === 'recuar') {
      inicio = this.addMonths(refIni, -n);
      fimExclusivo = refIni;
    } else {
      inicio = refIni;
      fimExclusivo = this.addMonths(refIni, n);
    }
    return {
      ref: refIni.slice(0, 7),
      direcao,
      n,
      inicio,
      fimExclusivo,
      fim: this.addDays(fimExclusivo, -1),
    };
  }

  /** Cada mês do período, em ordem cronológica. */
  mesesDoPeriodo(periodo: Periodo): MesPeriodo[] {
    const out: MesPeriodo[] = [];
    let d = periodo.inicio;
    while (d < periodo.fimExclusivo) {
      const [ano, mes] = d.split('-').map(Number);
      out.push({ ano, mes, nome: MESES_PT[mes] });
      d = this.addMonths(d, 1);
    }
    return out;
  }

  /** `{mes(1-12): ano}` — a que ano aquele mês corresponde dentro do período atual (1ª
   * ocorrência). */
  atalhosMes(meses: MesPeriodo[]): Record<number, number> {
    const out: Record<number, number> = {};
    for (const m of meses) {
      if (!(m.mes in out)) out[m.mes] = m.ano;
    }
    return out;
  }

  /** Normaliza um valor de data vindo do driver (Date/string) para "AAAA-MM-DD", ou null. */
  private comoData(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = textoAparado(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  async listarDisponiveis(): Promise<
    { id: number; slug: string; nome: string; mostrarGrafico: boolean }[]
  > {
    const consultas = await this.consultas.listar();
    return consultas
      .filter((c) => c.colunaData.trim())
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        nome: c.nome,
        mostrarGrafico: c.mostrarGrafico,
      }));
  }

  async rodar(
    slug: string,
    query: QueryDashboard,
  ): Promise<ResultadoDashboard> {
    const periodo = this.periodo(query);
    const meses = this.mesesDoPeriodo(periodo);
    const atalhos = this.atalhosMes(meses);
    const mesSel = query.mesSel ? Number(query.mesSel) || null : null;
    const anoSel = query.anoSel ? Number(query.anoSel) || null : null;
    const situacoesSelParam = new Set((query.situacao ?? []).filter(Boolean));

    const base: ResultadoDashboard = {
      slug,
      nome: slug,
      periodo,
      meses,
      atalhos,
      mesSel,
      anoSel,
      situacoesDisponiveis: [],
      situacoesSelecionadas: [],
      linhasTabela: [],
      grafico: null,
      totalPeriodo: 0,
      erro: null,
    };

    const consulta = await this.consultas.porSlug(slug);
    if (!consulta || !consulta.sql.trim()) {
      return {
        ...base,
        erro: `Consulta '${slug}' não configurada (Consultas BD, área Sistema).`,
      };
    }
    base.nome = consulta.nome;
    // Cada consulta roda na SUA conexão (campo `conexao`): 'portal' = banco do Portal
    // Rech (MySQL); default = Oracle da Disponibilidade.
    const noPortal = consulta.conexao === 'portal';
    if (!noPortal && !this.disponibilidade.configurado()) {
      return {
        ...base,
        erro: 'Conexão externa (Consultas BD → Disponibilidade) não configurada ou inativa.',
      };
    }

    const binds = { data_ini: periodo.inicio, data_fim: periodo.fim };
    const r = noPortal
      ? await this.portalDb.executarSql(consulta.sql, binds)
      : await this.disponibilidade.executarSql(consulta.sql, binds);
    if (!r.ok) return { ...base, erro: r.mensagem };

    const colunaData = consulta.colunaData.toUpperCase();
    const colunaSituacao = consulta.colunaSituacao.toUpperCase();
    const contagemMes = new Map<string, number>(
      meses.map((m) => [`${m.ano}-${m.mes}`, 0]),
    );
    const situacoesDisp: string[] = [];
    const linhasPeriodo: {
      linha: Record<string, unknown>;
      data: string;
      situacao: string;
    }[] = [];

    for (const linhaBruta of r.linhas) {
      const linha: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(linhaBruta))
        linha[(k || '').toUpperCase()] = v;
      const dData = colunaData ? this.comoData(linha[colunaData]) : null;
      if (
        colunaData &&
        (!dData || dData < periodo.inicio || dData >= periodo.fimExclusivo)
      )
        continue;
      const situacao = colunaSituacao
        ? textoAparado(linha[colunaSituacao])
        : '';
      if (situacao && !situacoesDisp.includes(situacao))
        situacoesDisp.push(situacao);
      linhasPeriodo.push({ linha, data: dData ?? '', situacao });
    }
    situacoesDisp.sort();
    // nada marcado na URL = "seleções múltiplas" (todas) — mesmo default do Flask original
    const situacoesSel =
      situacoesSelParam.size > 0 ? situacoesSelParam : new Set(situacoesDisp);

    const linhasTabela: Record<string, unknown>[] = [];
    for (const { linha, data, situacao } of linhasPeriodo) {
      if (situacao && !situacoesSel.has(situacao)) continue;
      if (colunaData && data) {
        const [ano, mes] = data.split('-').map(Number);
        const chave = `${ano}-${mes}`;
        if (contagemMes.has(chave))
          contagemMes.set(chave, (contagemMes.get(chave) ?? 0) + 1);
        if (mesSel && anoSel && (ano !== anoSel || mes !== mesSel)) continue;
      }
      linhasTabela.push(linha);
    }
    if (colunaData) {
      linhasTabela.sort((a, b) => {
        const da = this.comoData(a[colunaData]) ?? '';
        const db = this.comoData(b[colunaData]) ?? '';
        return da.localeCompare(db);
      });
    }

    const grafico =
      consulta.mostrarGrafico && colunaData
        ? {
            labels: meses.map((m) => m.nome),
            valores: meses.map(
              (m) => contagemMes.get(`${m.ano}-${m.mes}`) ?? 0,
            ),
          }
        : null;

    return {
      ...base,
      situacoesDisponiveis: situacoesDisp,
      situacoesSelecionadas: [...situacoesSel],
      linhasTabela,
      grafico,
      totalPeriodo: [...contagemMes.values()].reduce((a, b) => a + b, 0),
    };
  }
}
