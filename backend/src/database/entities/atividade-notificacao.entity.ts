import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TipoNotificacaoAtividade =
  'solicitacao' | 'compartilhado' | 'comentario' | 'prazo';

/** Aviso pendente para UM usuário do Painel (decisão 4 do usuário, 2026-09-01).
 *
 * A linha existe porque o aviso é **persistente**: o pop-up do canto inferior direito fica
 * aberto até a pessoa fechar, e precisa sobreviver a recarregar a página, trocar de máquina e
 * ao próprio Painel reiniciar. Um evento em memória (WebSocket, fila) não daria isso.
 *
 * É separada de `atividade_eventos` de propósito: aquilo é auditoria (o que aconteceu, para
 * sempre); isto é caixa de entrada (o que ainda não foi visto, por pessoa). O mesmo evento
 * gera N notificações, uma por destinatário. */
@Entity({ name: 'atividade_notificacoes' })
@Index(['usuarioId', 'lida'])
export class AtividadeNotificacao {
  @PrimaryGeneratedColumn()
  id: number;

  /** Destinatário — sempre um usuário do Painel (o contato do cliente com conta inclusive).
   * Quem não tem conta recebe só o e-mail, que sai por fora desta tabela. */
  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ name: 'quadro_id' })
  quadroId: number;

  @Column({ name: 'cartao_id', type: 'int', nullable: true })
  cartaoId: number | null;

  /** Código do cliente do quadro — a tela precisa dele para abrir o cartão sem uma segunda
   * consulta (a rota do quadro é por código, não por id). */
  @Column({ name: 'codigo_cliente_sicla', length: 40, default: '' })
  codigoClienteSicla: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoNotificacaoAtividade;

  @Column({ length: 200, default: '' })
  titulo: string;

  @Column({ type: 'text', default: '' })
  texto: string;

  @Column({ type: 'boolean', default: false })
  lida: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
