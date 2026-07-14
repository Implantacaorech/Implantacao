import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TipoEvento = 'nota' | 'etapa' | 'documento' | 'email' | 'alerta';

/** Item da timeline/histórico de um projeto (auditoria + passagem de bastão). Espelha
 * webapp/db.py:Evento. */
@Entity({ name: 'eventos' })
export class Evento {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ type: 'varchar', length: 30, default: 'nota' })
  tipo: TipoEvento;

  @Column({ type: 'text', default: '' })
  descricao: string;

  @Column({ length: 120, default: '' })
  autor: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
