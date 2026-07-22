import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Papel de uma pessoa DENTRO de um projeto. No sistema, levantador e consultor são o mesmo
 * PERFIL (`Consultor`); o que os distingue é o papel aqui. */
export type PapelProjeto = 'levantador' | 'consultor';

/** Vínculo pessoa × projeto × papel.
 *
 * Existe porque um projeto pode ter MAIS DE UM levantador e MAIS DE UM consultor (revisão do
 * processo em 2026-07-22). O GCI continua em `Projeto.gci`, campo único, porque é único por
 * definição.
 *
 * `Projeto.consultor` segue sendo preenchido com a lista consolidada, para não quebrar as
 * telas, os filtros e os documentos que já leem aquele campo — quem manda é esta tabela. */
@Entity({ name: 'projeto_pessoas' })
@Index(['projetoId', 'papel'])
export class ProjetoPessoa {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  /** Nome da pessoa como aparece no cadastro de usuários (mesma convenção de
   * `Projeto.consultor`/`Projeto.gci`, que guardam nome, não id). */
  @Column({ length: 160 })
  pessoa: string;

  @Column({ type: 'varchar', length: 20 })
  papel: PapelProjeto;

  @Column({
    name: 'criado_em',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  criadoEm: Date;
}
