/** Teto de linhas — a view tem ~2,9 mil no total, então 5.000 cobre com folga. */
export const LIMITE_INDICADORES = 5000;

/** Uma RNS de implantação, já normalizada (datas em ISO, horas em decimal). */
export interface LinhaIndicador {
  codigo: number;
  descricao: string;
  cliente: number | null;
  fantasia: string;
  responsavel: string;
  representante: string;
  /** AAAA-MM-DD (convertido do `DD/MM/YYYY` que a view devolve). */
  dataContratacao: string;
  dataEncerramento: string;
  dataCriacao: string;
  dataPrevisaoUso: string;
  dataTransicao: string;
  /** AAAA-MM. */
  competenciaContratacao: string;
  competenciaEncerramento: string;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  /** Normais + adicionais, como o BI soma. */
  horasCobradas: number;
  horasBonificadas: number;
  /** % de consumo das horas contratadas (null quando não há contratação). */
  percentualUtilizacao: number | null;
  posicao: string;
  tipoImplantacao: string;
  area: string;
  tipoSuporte: string;
  statusImp: number;
  grupoEconomico: string;
  /** Meses entre contratação e encerramento — null enquanto não encerrou. */
  leadTimeMeses: number | null;
  concluida: boolean;
}

export interface TotaisIndicadores {
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
  concluidos: number;
  /** Média de lead-time (meses) entre os que têm encerramento. */
  leadTimeMedio: number | null;
}

/** Agregado por competência (mês) — alimenta os gráficos das três páginas. */
export interface SerieMensal {
  competencia: string;
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasCobradas: number;
  horasBonificadas: number;
  /** % realizadas/contratadas do mês. */
  percentualUtilizacao: number | null;
}

export interface ContagemIndicador {
  chave: string;
  quantidade: number;
  horasContratadas: number;
  horasRealizadas: number;
}
