import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Papel de uma pessoa DENTRO de um projeto. No sistema, levantador e consultor são o mesmo
 * PERFIL (`Consultor`); o que os distingue é o papel aqui.
 *
 * `gci` entrou em 2026-08-06: até então o GCI vivia só em `Projeto.gci` (texto), e por isso
 * a autorização dele não tinha como ser por identidade. */
export type PapelProjeto = 'levantador' | 'consultor' | 'gci';

/** Vínculo pessoa × projeto × papel.
 *
 * Existe porque um projeto pode ter MAIS DE UM levantador e MAIS DE UM consultor (revisão do
 * processo em 2026-07-22) — e, na prática, mais de um GCI.
 *
 * `Projeto.consultor` e `Projeto.gci` seguem preenchidos com a lista consolidada, para não
 * quebrar as telas, os filtros, os tokens de e-mail e os documentos que já leem aqueles
 * campos — quem manda é esta tabela. */
@Entity({ name: 'projeto_pessoas' })
@Index(['projetoId', 'papel'])
export class ProjetoPessoa {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  /** Nome da pessoa como aparece no cadastro de usuários. Continua sendo o RÓTULO — o que
   * identifica é `usuarioId`. Mantido porque telas, documentos e o espelho em
   * `Projeto.consultor`/`Projeto.gci` exibem nome, e porque é o único dado de vínculos
   * antigos cujo nome não bate com nenhum usuário ativo. */
  @Column({ length: 160 })
  pessoa: string;

  /** QUEM é a pessoa, de verdade.
   *
   * O nome era a única chave até 2026-08-05, e isso tornava homônimos indistinguíveis: um
   * segundo usuário chamado igual ao consultor designado concluía os passos do projeto e
   * recebia os e-mails dele (achado da auditoria dos 21 passos). Nulo só em vínculo antigo
   * cujo nome não casou com nenhum usuário ativo na migração — nesses, a autorização cai de
   * volta na comparação por nome, que é o comportamento que já existia. */
  @Index()
  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ type: 'varchar', length: 20 })
  papel: PapelProjeto;

  @Column({
    name: 'criado_em',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  criadoEm: Date;
}
