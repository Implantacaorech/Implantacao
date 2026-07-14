import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StatusAgenda =
  | 'Solicitada'
  | 'Agendada'
  | 'Realizada'
  | 'Não Realizada'
  | 'Postergada'
  | 'Cancelada';

export const CRONO_STATUS_AGENDA: StatusAgenda[] = [
  'Solicitada',
  'Agendada',
  'Realizada',
  'Não Realizada',
  'Postergada',
  'Cancelada',
];

/** Atividade alocável do Agendador de Visitas (deriva do Check List). Espelha
 * webapp/db.py:AtividadeCronograma. */
@Entity({ name: 'cronograma_atividades' })
export class AtividadeCronograma {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ length: 40, default: '' })
  modulo: string;

  // nº da Visita (V{seq}) dentro do módulo.
  @Column({ default: 0 })
  seq: number;

  // ordem da atividade dentro da visita.
  @Column({ default: 0 })
  ordem: number;

  @Column({ type: 'text', default: '' })
  descricao: string;

  @Column({ length: 60, default: '' })
  tipo: string;

  // "AAAA-MM-DD"; "" = não alocada.
  @Column({ length: 10, default: '' })
  data: string;

  // "manha" | "tarde" | ""
  @Column({ length: 10, default: '' })
  turno: string;

  @Column({ length: 120, default: '' })
  tecnico: string;

  @Column({ type: 'varchar', length: 20, default: 'Solicitada' })
  status: StatusAgenda;

  // destino da postergação (anotado no card histórico Postergada).
  @Column({ name: 'nova_data', length: 10, default: '' })
  novaData: string;

  @Column({ name: 'novo_turno', length: 10, default: '' })
  novoTurno: string;

  // id da atividade que originou (clone de postergação).
  @Column({ name: 'origem_id', default: 0 })
  origemId: number;

  @Column({ name: 'is_copia', default: false })
  isCopia: boolean;

  // True = data/turno vieram da distribuição automática e ainda não foram tocados à mão
  // (permite "Refazer" desfazer só isso, nunca uma alocação manual).
  @Column({ name: 'auto_agendado', default: false })
  autoAgendado: boolean;
}
