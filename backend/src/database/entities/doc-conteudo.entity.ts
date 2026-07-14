import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DocumentoConteudo = 'levantamento' | 'projeto';

/** Campo estruturado de um documento (levantamento/projeto) por projeto — as telas de
 * edição (espelho do layout) gravam aqui; a geração lê para preencher o .docx. Espelha
 * webapp/db.py:DocConteudo. */
@Entity({ name: 'doc_conteudo' })
export class DocConteudo {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Column({ type: 'varchar', length: 30, default: '' })
  doc: DocumentoConteudo;

  @Column({ length: 60, default: '' })
  campo: string;

  @Column({ type: 'text', default: '' })
  valor: string;
}
