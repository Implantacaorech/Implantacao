/** "Movimentos de trabalho efetivo" (aba BI Implantação). Espelha `GET /bi-movimentos`. */

export interface ContagemMovimentoBi {
  chave: string;
  quantidade: number;
  horasTotal: number;
  horasCobradas: number;
  horasNaoCobradas: number;
  percentualCobradas: number | null;
}

export interface TotaisMovimentosBi {
  quantidade: number;
  tecnicos: number;
  horasTotal: number;
  horasCobradas: number;
  horasNaoCobradas: number;
  percentualCobradas: number | null;
}

export interface FiltrosMovimentosBi {
  tecnicos: string[];
  tiposMovimento: string[];
}

export interface ResultadoMovimentosBi {
  periodo: { inicio: string; fim: string };
  /** A janela pedida passava do teto (6 meses) e foi recortada — a tela avisa. */
  periodoLimitado: boolean;
  porTecnico: ContagemMovimentoBi[];
  porTpMovimento: ContagemMovimentoBi[];
  totais: TotaisMovimentosBi;
  filtros: FiltrosMovimentosBi;
  selecionados: FiltrosMovimentosBi;
  erro: string | null;
}

export interface FiltroMovimentosBi {
  dataIni?: string;
  dataFim?: string;
  tecnico?: string[];
  tpMovimento?: string[];
  cobraHora?: string[];
}
