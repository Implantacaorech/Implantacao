import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Quem responde por um quadro — é ISTO que define "meus clientes" na coluna da esquerda
 * (docs/controle-atividades.md §2.7).
 *
 * **Por que uma tabela própria e não `projeto_pessoas`:** o quadro é chaveado pelo código do
 * cliente no SICLA, e `projetos` não guarda esse código. Derivar "meu" da designação do
 * projeto exigiria casar cliente por NOME — frágil e silencioso quando erra. Aqui o vínculo
 * é explícito: quem abre o quadro entra como responsável, e os demais são acrescentados à
 * mão (podendo ser SUGERIDOS a partir de `projeto_pessoas` quando o quadro tem projeto).
 *
 * Ser responsável é o que dá ESCRITA. A leitura é geral: todo usuário interno lê todos os
 * quadros — a fronteira que o módulo protege é Rech ↔ cliente, nunca consultor ↔ consultor. */
@Entity({ name: 'atividade_quadro_responsaveis' })
@Index(['quadroId', 'usuarioId'], { unique: true })
export class AtividadeQuadroResponsavel {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'quadro_id' })
  quadroId: number;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  /** Responsável PRINCIPAL do quadro (quem o abriu, por padrão). Só rotula — não muda
   * permissão: todo responsável escreve igual. */
  @Column({ type: 'boolean', default: false })
  principal: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
