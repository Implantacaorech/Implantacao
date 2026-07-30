import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Para quem o e-mail de um passo é enviado, quando o padrão do código não basta.
 *
 * O padrão (`EMAILS_POR_PASSO.para`) resolve os grupos que o próprio projeto conhece — o GCI
 * designado, os consultores, o contato no cliente. O que ele NÃO tem como saber são os
 * endereços fixos da Rech: os dois grupos avisados quando um cliente novo é cadastrado
 * (passo 1) são listas internas, mudam sem release e não podem morar no código.
 *
 * Uma linha por passo. Ausência de linha = vale o padrão do código; é por isso que a tabela
 * nasce vazia e o sistema continua funcionando. */
@Entity({ name: 'destinatarios_passo' })
export class DestinatarioPassoConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  passo: number;

  /** Grupos dinâmicos, separados por vírgula (`administrativo,gci,…` — ver
   * `DestinatarioPasso`). Vazio significa "nenhum grupo dinâmico", não "use o padrão": quem
   * salvou a linha decidiu explicitamente. */
  @Column({ type: 'text', default: '' })
  grupos: string;

  /** Endereços fixos, separados por vírgula ou ponto-e-vírgula. É aqui que entram os grupos
   * de e-mail da Rech. */
  @Column({ type: 'text', default: '' })
  extras: string;

  /** Desliga o e-mail do passo sem apagar a configuração — útil para suspender um aviso
   * durante um período sem perder a lista de quem recebe. */
  @Column({ default: true })
  ativo: boolean;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
