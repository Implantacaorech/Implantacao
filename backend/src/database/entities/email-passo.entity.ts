import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type StatusEmailPasso = 'enviado' | 'falhou' | 'sem_destinatario';

/** O e-mail que o Painel gerou em um passo — guardado por inteiro, para consulta.
 *
 * A timeline (`Evento` com `tipo: 'email'`) já registrava que um e-mail saiu, mas só como
 * uma frase: não dá para reler o que foi mandado. O processo exige mais do que isso —
 * qualquer pessoa com acesso ao menu precisa poder abrir um projeto e VER o e-mail de cada
 * passo, com destinatários, assunto e corpo. É uma tabela de histórico: nunca se edita uma
 * linha, só se acrescenta.
 *
 * Guarda também o que FALHOU (`status`), de propósito: um e-mail que não saiu é justamente
 * o que alguém precisa descobrir ao conferir o andamento. */
@Entity({ name: 'emails_passo' })
export class EmailPasso {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'projeto_id' })
  projetoId: number;

  @Index()
  @Column()
  passo: number;

  /** Destinatários efetivamente usados, separados por vírgula. */
  @Column({ type: 'text', default: '' })
  para: string;

  @Column({ length: 300, default: '' })
  assunto: string;

  @Column({ type: 'text', default: '' })
  corpo: string;

  /** Nome do arquivo que foi junto, quando houve anexo. */
  @Column({ length: 255, default: '' })
  anexo: string;

  @Column({ type: 'varchar', length: 20, default: 'enviado' })
  status: StatusEmailPasso;

  /** Motivo da falha, quando `status` não é 'enviado'. */
  @Column({ type: 'text', default: '' })
  erro: string;

  /** Quem disparou — o nome de quem concluiu o passo, ou 'sistema'. */
  @Column({ length: 160, default: '' })
  autor: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
