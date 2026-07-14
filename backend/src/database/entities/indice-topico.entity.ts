import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const INDICE_CAMPOS = [
  'moduloNum',
  'moduloSigla',
  'modulo',
  'adicionalNum',
  'adicionalSigla',
  'adicional',
  'topico',
] as const;

/** Tópico do "Índice de Tópicos para Mapeamento de Processos" — catálogo editável, fonte
 * do seed de LevantamentoResposta por projeto. Espelha webapp/db.py:IndiceTopico. */
@Entity({ name: 'indice_topicos' })
export class IndiceTopico {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ default: 0 })
  ordem: number;

  @Column({ name: 'modulo_num', length: 10, default: '' })
  moduloNum: string;

  @Column({ name: 'modulo_sigla', length: 10, default: '' })
  moduloSigla: string;

  @Column({ length: 120, default: '' })
  modulo: string;

  @Column({ name: 'adicional_num', length: 10, default: '' })
  adicionalNum: string;

  @Column({ name: 'adicional_sigla', length: 10, default: '' })
  adicionalSigla: string;

  @Column({ length: 120, default: '' })
  adicional: string;

  @Column({ type: 'text', default: '' })
  topico: string;
}
