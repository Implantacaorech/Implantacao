export type StatusAgenda = 'Solicitada' | 'Agendada' | 'Realizada' | 'Não Realizada' | 'Postergada' | 'Cancelada';

export const CRONO_STATUS_AGENDA: StatusAgenda[] = [
  'Solicitada',
  'Agendada',
  'Realizada',
  'Não Realizada',
  'Postergada',
  'Cancelada',
];

export interface AtividadeCronograma {
  id: number;
  projetoId: number;
  modulo: string;
  seq: number;
  ordem: number;
  descricao: string;
  tipo: string;
  data: string;
  turno: string;
  tecnico: string;
  status: StatusAgenda;
  novaData: string;
  novoTurno: string;
  origemId: number;
  isCopia: boolean;
  autoAgendado: boolean;
}

export interface VisitaAgrupada {
  modulo: string;
  seq: number;
  atividades: AtividadeCronograma[];
}

export interface Designacao {
  modulo: string;
  consultor: string;
  ordem: number;
  naoDistribuir: boolean;
  analista: string;
}

export interface HorariosPorTurno {
  manha: { inicio: string; fim: string };
  tarde: { inicio: string; fim: string };
}

export type ModoDisponibilidade = 'conjunta' | 'individual';

export interface CronogramaConfigDto {
  modoDisponibilidade: ModoDisponibilidade;
  dataInicio: string;
  diasTurnosExcluidos: string;
  analistaPadrao: string;
}

export interface PeriodoBloqueado {
  id: number;
  projetoId: number;
  dataIni: string;
  dataFim: string;
  motivo: string;
  tecnicos: string;
}

export interface ResultadoDistribuicao {
  ok: boolean;
  erro?: string;
  n?: number;
  semSlot?: string[];
  estourouGolive?: string[];
  aviso?: string;
}

export interface Prontidao {
  faltantes: string[];
  jaOcorreu: boolean;
}

export const NOMES_DIA_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
