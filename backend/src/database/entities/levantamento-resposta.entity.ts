import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Uma linha do questionário do Levantamento (semeada do Índice de Tópicos dos módulos
 * contratados) com a resposta digitada pelo consultor. Espelha
 * webapp/db.py:LevantamentoResposta. */
@Entity({ name: 'levantamento_respostas' })
export class LevantamentoResposta {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ default: 0 })
  ordem: number;

  @Column({ name: 'modulo_sigla', length: 10, default: '' })
  moduloSigla: string;

  @Column({ length: 120, default: '' })
  modulo: string;

  @Column({ length: 120, default: '' })
  adicional: string;

  @Column({ type: 'text', default: '' })
  topico: string;

  @Column({ type: 'text', default: '' })
  resposta: string;
}
