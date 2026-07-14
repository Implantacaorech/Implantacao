import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Linha da Matriz de Conhecimento: um técnico e suas notas (0-10 por competência,
 * casado ao Usuario pelo Código SICLA ou pelo nome). Espelha webapp/db.py:MatrizTecnico —
 * `notas` continua um blob JSON `{sigla: nota}` (não normalizado em tabela própria),
 * fidelidade ao original. */
@Entity({ name: 'matriz_tecnicos' })
export class MatrizTecnico {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 120, default: '' })
  nome: string;

  @Column({ length: 80, default: '' })
  setor: string;

  @Column({ length: 20, default: '' })
  dias: string;

  @Column({ type: 'text', default: '{}' })
  notas: string;

  @Column({ name: 'atualizado_em', nullable: true })
  atualizadoEm: Date;

  @Column({ name: 'atualizado_por', length: 120, default: '' })
  atualizadoPor: string;
}
