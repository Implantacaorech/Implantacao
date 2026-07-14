import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Período em que o projeto não pode ter visita alguma (recesso, férias coletivas etc.) —
 * bloqueia tanto a distribuição automática quanto a alocação manual. `tecnicos` vazio = vale
 * para todos; preenchido (nomes separados por vírgula) = só para esses. Espelha
 * webapp/db.py:CronogramaPeriodoBloqueado. */
@Entity({ name: 'cronograma_periodos_bloqueados' })
export class CronogramaPeriodoBloqueado {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ name: 'data_ini', length: 10, default: '' })
  dataIni: string;

  @Column({ name: 'data_fim', length: 10, default: '' })
  dataFim: string;

  @Column({ length: 160, default: '' })
  motivo: string;

  @Column({ length: 400, default: '' })
  tecnicos: string;
}
