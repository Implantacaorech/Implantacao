import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TipoModeloDocumento = 'docx' | 'xlsx';

/** 1 por fase (Levantamento, Projeto, Cronograma, Termo) — o arquivo VIGENTE (`arquivo`) é o
 * usado na geração. Espelha webapp/db.py:ModeloDocumento. */
@Entity({ name: 'modelos_documento' })
export class ModeloDocumento {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 40, default: '' })
  slug: string;

  @Column({ length: 160, default: '' })
  nome: string;

  @Column({ length: 40, default: '' })
  fase: string;

  @Column({ type: 'varchar', length: 10, default: 'docx' })
  tipo: TipoModeloDocumento;

  // nome do arquivo vigente no store gravável (backend/dados/modelos_documento/).
  @Column({ length: 200, default: '' })
  arquivo: string;

  @Column({ type: 'text', default: '' })
  descricao: string;

  @Column({ default: 0 })
  ordem: number;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
