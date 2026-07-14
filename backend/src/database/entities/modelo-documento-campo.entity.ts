import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Mapa de preenchimento (placeholder do layout -> de onde vem no projeto) — só
 * informativo, exibido na tela de Cadastros; a geração em si não lê esta tabela (a lógica
 * de preenchimento já está em código nos módulos `gl_*`). Espelha
 * webapp/db.py:ModeloDocumentoCampo. */
@Entity({ name: 'modelos_documento_campos' })
export class ModeloDocumentoCampo {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'modelo_id' })
  modeloId: number;

  @Column({ default: 0 })
  ordem: number;

  @Column({ length: 120, default: '' })
  secao: string;

  @Column({ length: 200, default: '' })
  placeholder: string;

  @Column({ length: 160, default: '' })
  rotulo: string;

  @Column({ length: 160, default: '' })
  origem: string;

  @Column({ default: false })
  obrigatorio: boolean;

  @Column({ type: 'text', default: '' })
  observacao: string;
}
