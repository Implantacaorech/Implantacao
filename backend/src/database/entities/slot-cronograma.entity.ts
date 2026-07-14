import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Horário GLOBAL de início/fim por turno do Agendador (uma linha por turno, data=""). Espelha
 * webapp/db.py:SlotCronograma. */
@Entity({ name: 'cronograma_slots' })
export class SlotCronograma {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  // "" = global (um horário para todas as visitas) — nenhum outro valor é usado hoje.
  @Column({ length: 10, default: '' })
  data: string;

  @Column({ length: 10, default: '' })
  turno: string;

  @Column({ name: 'hora_inicio', length: 5, default: '' })
  horaInicio: string;

  @Column({ name: 'hora_fim', length: 5, default: '' })
  horaFim: string;
}
