import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EntidadeModificacao = 'cronograma' | 'checklist';

/** Histórico de modificações linha-a-linha do Cronograma/Check List — cada linha
 * adicionada/removida/editada gera um registro aqui. Espelha
 * webapp/db.py:Modificacao. */
@Entity({ name: 'modificacoes' })
export class Modificacao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ type: 'varchar', length: 30, default: '' })
  entidade: EntidadeModificacao;

  // ex.: "linha 3" (linha inteira) ou "linha 3 · status" (campo específico).
  @Column({ length: 60, default: '' })
  ref: string;

  // ex.: "status", ou "linha" quando a linha inteira foi criada/removida.
  @Column({ length: 40, default: '' })
  campo: string;

  @Column({ type: 'text', default: '' })
  de: string;

  @Column({ type: 'text', default: '' })
  para: string;

  @Column({ length: 120, default: '' })
  autor: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
