import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Catálogo de competências (colunas da planilha), agrupadas por área, na ordem
 * original. Espelha webapp/db.py:MatrizCompetencia. */
@Entity({ name: 'matriz_competencias' })
export class MatrizCompetencia {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ length: 80, default: '' })
  sigla: string;

  @Column({ length: 80, default: '' })
  area: string;

  @Column({ default: 0 })
  ordem: number;
}
