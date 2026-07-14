import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Histórico de arquivos de um ModeloDocumento — a versão `vigente` é a usada na geração.
 * Espelha webapp/db.py:ModeloDocumentoVersao. */
@Entity({ name: 'modelos_documento_versoes' })
export class ModeloDocumentoVersao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'modelo_id' })
  modeloId: number;

  @Column({ default: 1 })
  versao: number;

  @Column({ length: 200, default: '' })
  arquivo: string;

  @Column({ length: 120, default: '' })
  autor: string;

  @Column({ type: 'text', default: '' })
  motivo: string;

  @Column({ default: false })
  vigente: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
