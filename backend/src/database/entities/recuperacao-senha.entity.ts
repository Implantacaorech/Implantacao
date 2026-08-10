import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Pedido de "Esqueci minha senha" em andamento: aguarda o código de 6 dígitos enviado por
 * e-mail. Mesma mecânica do auto-cadastro (`CadastroPendente`), com duas diferenças que
 * importam por ser um caminho de recuperação de acesso:
 *
 * - o código é guardado como HASH (nunca em claro) — quem lesse a tabela poderia assumir a
 *   conta de qualquer usuário até o código expirar;
 * - guarda `usuarioId`, não os dados da conta: o alvo já existe, só a senha muda.
 *
 * A janela é curta (15 min) e o registro é descartado assim que a senha é redefinida, ou
 * quando estoura o limite de tentativas. */
@Entity({ name: 'recuperacoes_senha' })
export class RecuperacaoSenha {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  /** E-mail para o qual o código foi enviado — é por ele que a tela de redefinição
   * localiza o pedido (o usuário digita o e-mail, não o id). */
  @Index()
  @Column({ length: 160, default: '' })
  email: string;

  @Column({ name: 'codigo_hash', type: 'text', default: '' })
  codigoHash: string;

  @Column({ default: 0 })
  tentativas: number;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
