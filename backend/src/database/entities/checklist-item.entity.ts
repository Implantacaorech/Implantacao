import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StatusChecklistItem =
  'Pendente' | 'Em andamento' | 'Concluído' | 'N/A';

export const CHECK_STATUS: StatusChecklistItem[] = [
  'Pendente',
  'Em andamento',
  'Concluído',
  'N/A',
];

/** Linha EDITÁVEL do documento Check List, rastreada durante a implantação (status por
 * linha). Espelha webapp/db.py:ChecklistItem. Vive em `plano-cronograma/` junto com
 * `CronogramaItem` — mesma tela/fluxo no Flask original (`plano_checklist.html`). */
@Entity({ name: 'checklist_itens' })
export class ChecklistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ default: 0 })
  ordem: number;

  @Column({ length: 80, default: '' })
  modulo: string;

  @Column({ type: 'text', default: '' })
  item: string;

  @Column({ length: 160, default: '' })
  responsavel: string;

  @Column({ type: 'varchar', length: 30, default: 'Pendente' })
  status: StatusChecklistItem;

  @Column({ type: 'text', default: '' })
  obs: string;
}
