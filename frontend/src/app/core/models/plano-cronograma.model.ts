export type StatusCronogramaItem = 'Previsto' | 'Agendado' | 'Concluído' | 'Cancelado';
export const CRONO_STATUS: StatusCronogramaItem[] = ['Previsto', 'Agendado', 'Concluído', 'Cancelado'];

export interface CronogramaItem {
  id: number;
  projetoId: number;
  ordem: number;
  etapa: string;
  topicos: string;
  horas: string;
  data: string;
  modalidade: string;
  status: StatusCronogramaItem;
}

export type LinhaCronograma = Pick<CronogramaItem, 'etapa' | 'topicos' | 'horas' | 'data' | 'modalidade' | 'status'>;

export type StatusChecklistItem = 'Pendente' | 'Em andamento' | 'Concluído' | 'N/A';
export const CHECK_STATUS: StatusChecklistItem[] = ['Pendente', 'Em andamento', 'Concluído', 'N/A'];

export interface ChecklistItem {
  id: number;
  projetoId: number;
  ordem: number;
  modulo: string;
  item: string;
  responsavel: string;
  status: StatusChecklistItem;
  obs: string;
}

export type LinhaChecklist = Pick<ChecklistItem, 'modulo' | 'item' | 'responsavel' | 'status' | 'obs'>;

export interface Modificacao {
  id: number;
  projetoId: number;
  entidade: 'cronograma' | 'checklist';
  ref: string;
  campo: string;
  de: string;
  para: string;
  autor: string;
  criadoEm: string;
}
