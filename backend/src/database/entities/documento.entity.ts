import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OrigemDocumento = 'gerado' | 'importado';

/** Documento gerado/anexado a um projeto (histórico/versionado). Espelha
 * webapp/db.py:Documento. */
@Entity({ name: 'documentos' })
export class Documento {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ length: 40, default: '' })
  tipo: string;

  @Column({ length: 255, default: '' })
  arquivo: string;

  @Column({ type: 'text', default: '' })
  caminho: string;

  @Column({ type: 'varchar', length: 20, default: 'gerado' })
  origem: OrigemDocumento;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
