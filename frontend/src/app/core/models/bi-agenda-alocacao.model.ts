/** "Alocação de Agendas" (aba BI Implantação): Calendário de compromissos dos técnicos e
 * Horas Aplicadas por RNS de implantação. Espelha `GET /bi-agenda-alocacao/*`. */

export interface LinhaAlocacaoBi {
  codigo: number;
  dia: string;
  horaIni: string;
  horaFim: string;
  status: string;
  assunto: string;
  minutos: number;
  rns: number | null;
  especie: number;
  especieDes: string;
  tecnico: string;
  tipoSuporte: string;
  /** Observação da agenda no SICLA (pauta, link da reunião…) — pode ser longa. */
  observacao: string;
  fantasia: string;
  rnsDescricao: string;
  grupoEconomico: string;
}

export interface DiaAlocacaoBi {
  dia: string;
  numero: number;
  diaSemana: number;
  compromissos: LinhaAlocacaoBi[];
}

export interface ResumoStatusAlocacaoBi {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

export interface FiltrosCalendarioAlocacaoBi {
  grupos: string[];
  responsaveis: string[];
  tiposSuporte: string[];
  status: string[];
}

export interface ResultadoCalendarioAlocacaoBi {
  mes: string;
  dias: DiaAlocacaoBi[];
  resumo: ResumoStatusAlocacaoBi[];
  totalCompromissos: number;
  filtros: FiltrosCalendarioAlocacaoBi;
  selecionados: FiltrosCalendarioAlocacaoBi;
  erro: string | null;
}

export interface FiltroCalendarioAlocacaoBi {
  mes?: string;
  grupo?: string[];
  responsavel?: string[];
  tipoSuporte?: string[];
  status?: string[];
}

export interface LinhaHorasAplicadasBi {
  rns: number;
  fantasia: string;
  rnsDescricao: string;
  responsavel: string;
  tipoSuporte: string;
  grupoEconomico: string;
  qtdCompromissos: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  percentualPostergada: number | null;
}

export interface TotaisHorasAplicadasBi {
  rnsQuantidade: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  percentualPostergada: number | null;
}

export interface FiltrosHorasAplicadasBi {
  grupos: string[];
  responsaveis: string[];
  tiposSuporte: string[];
}

export interface ResultadoHorasAplicadasBi {
  competencias: { inicio: string; fim: string };
  linhas: LinhaHorasAplicadasBi[];
  totais: TotaisHorasAplicadasBi;
  filtros: FiltrosHorasAplicadasBi;
  selecionados: FiltrosHorasAplicadasBi;
  erro: string | null;
}

export interface FiltroHorasAplicadasBi {
  compIni?: string;
  compFim?: string;
  grupo?: string[];
  responsavel?: string[];
  tipoSuporte?: string[];
}
