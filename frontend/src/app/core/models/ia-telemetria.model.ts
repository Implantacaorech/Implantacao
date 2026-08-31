/** Espelha o payload de `GET /api/ia/telemetria` (backend/src/ia-telemetria). */

export interface FinalidadeCustoIa {
  finalidade: string;
  execucoes: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
}

export interface ExecucaoIaResumo {
  finalidade: string;
  provider: string;
  modelo: string;
  solicitante: string;
  contexto: string;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  custoUsd: number | null;
  status: 'ok' | 'erro';
  criadoEm: string;
}

export interface TelemetriaIa {
  custoHojeUsd: number;
  custo7diasUsd: number;
  execucoesHoje: number;
  execucoes7dias: number;
  errosHoje: number;
  porFinalidade: FinalidadeCustoIa[];
  ultimas: ExecucaoIaResumo[];
  teto: {
    diarioUsd: number;
    atingido: boolean;
  };
}
