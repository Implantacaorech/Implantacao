export interface DashboardDisponivel {
  id: number;
  slug: string;
  nome: string;
  mostrarGrafico: boolean;
}

export interface PeriodoDashboard {
  ref: string;
  direcao: 'avancar' | 'recuar';
  n: number;
  inicio: string;
  fimExclusivo: string;
  fim: string;
}

export interface MesPeriodo {
  ano: number;
  mes: number;
  nome: string;
}

export interface ResultadoDashboard {
  slug: string;
  nome: string;
  periodo: PeriodoDashboard;
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

export interface FiltroDashboard {
  ref?: string;
  direcao?: 'avancar' | 'recuar';
  n?: number;
  situacao?: string[];
  mesSel?: number;
  anoSel?: number;
}
