import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Modelo de e-mail editável pelo ADM, com variáveis `{{VAR}}` substituídas no envio
 * (ver `ModeloEmailService.renderizar`). Espelha webapp/db.py:ModeloEmail. */
@Entity({ name: 'modelos_email' })
export class ModeloEmail {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 80, default: '' })
  slug: string;

  @Column({ length: 200, default: '' })
  nome: string;

  @Column({ length: 300, default: '' })
  assunto: string;

  @Column({ type: 'text', default: '' })
  corpo: string;

  // Etapa sugerida — só uma tag opcional de filtro, sem FK/enforcement (mesmo do Flask).
  @Column({ length: 80, default: '' })
  etapa: string;

  @Column({ default: true })
  ativo: boolean;

  // 1 = modelo padrão semeado no boot — não pode ser excluído (ver ModeloEmailService.excluir).
  @Column({ default: false })
  padrao: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
