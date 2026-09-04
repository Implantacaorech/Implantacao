import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Item de checklist de um cartão. `feitoPor` guarda o NOME de quem marcou porque o cartão é
 * compartilhado: saber que foi o cliente quem concluiu (e não a Rech) é a informação útil. */
@Entity({ name: 'atividade_checklist_itens' })
@Index(['cartaoId', 'ordem'])
export class AtividadeChecklistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'cartao_id' })
  cartaoId: number;

  @Column({ length: 300 })
  texto: string;

  @Column({ type: 'boolean', default: false })
  feito: boolean;

  @Column({ type: 'double', default: 0 })
  ordem: number;

  @Column({ name: 'feito_por', length: 160, default: '' })
  feitoPor: string;

  @Column({ name: 'feito_em', type: 'datetime', nullable: true })
  feitoEm: Date | null;
}
