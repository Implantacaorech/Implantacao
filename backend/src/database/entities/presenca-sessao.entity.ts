import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Uma ABA aberta no Painel — a unidade de presença (docs/controle-acessos.md).
 *
 * **Presença, não histórico.** A linha é sobrescrita a cada batida e apagada quando esfria:
 * o que fica gravado é "onde a pessoa está agora", nunca "por onde ela passou". Foi decisão
 * de desenho, e não limitação — um registro de trilha de navegação por pessoa é vigilância
 * de outra natureza, e não é o que foi pedido.
 *
 * A chave é (usuário, sessão), e não o usuário sozinho, porque a mesma pessoa abre o Painel
 * em duas abas ou em dois computadores. Com uma linha por usuário, a segunda aba
 * sobrescreveria a primeira e a tela mostraria a pessoa em um lugar só — errado, e sem
 * jeito de perceber. */
@Entity({ name: 'presenca_sessoes' })
@Index(['usuarioId', 'sessao'], { unique: true })
export class PresencaSessao {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  /** Identificador da ABA, gerado pelo navegador e guardado no `sessionStorage`. Some
   * quando a aba fecha, que é exatamente o ciclo de vida que se quer medir. */
  @Column({ length: 64 })
  sessao: string;

  /** Nome e perfil no momento da batida — a tela lista sem precisar juntar com `usuarios`,
   * e um cadastro renomeado depois não reescreve o que estava acontecendo agora. */
  @Column({ length: 160, default: '' })
  nome: string;

  @Column({ length: 40, default: '' })
  perfil: string;

  /** Caminho da SPA (`/atividades/10482`). É o "onde", em endereço. */
  @Column({ length: 300, default: '' })
  rota: string;

  /** Título da tela (`Controle de Atividades`), que cada rota declara em `data.titulo`. É o
   * "onde" em linguagem de gente — o que a tela de acompanhamento mostra. */
  @Column({ length: 160, default: '' })
  titulo: string;

  /** A aba está em primeiro plano? Distingue "trabalhando nesta tela" de "deixou aberta e
   * foi para outro programa" — sem isso, toda aba esquecida aberta contaria como alguém
   * usando o sistema. */
  @Column({ type: 'boolean', default: true })
  visivel: boolean;

  @Column({ length: 60, default: '' })
  ip: string;

  @Column({ length: 200, default: '' })
  navegador: string;

  @CreateDateColumn({ name: 'iniciado_em' })
  iniciadoEm: Date;

  @Index()
  @Column({ name: 'ultimo_ping', type: 'datetime' })
  ultimoPing: Date;
}
