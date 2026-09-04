import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TipoEventoAtividade =
  | 'cartao.criado'
  | 'cartao.movido'
  | 'cartao.compartilhado'
  | 'cartao.recolhido'
  | 'cartao.concluido'
  | 'cartao.reaberto'
  | 'cartao.arquivado'
  | 'anexo.incluido'
  | 'anexo.removido'
  | 'membro.incluido'
  | 'membro.removido';

/** Trilha de auditoria do quadro. **Não é opcional**: o cartão cruza a fronteira
 * Rech ↔ cliente, e "quem compartilhou isto, e quando" precisa ter resposta.
 *
 * `detalhe` é JSON serializado (texto) com o que o tipo do evento exigir — coluna JSON nativa
 * não é usada em lugar nenhum do Painel e o SQLite de teste não a suportaria igual. */
@Entity({ name: 'atividade_eventos' })
@Index(['quadroId', 'criadoEm'])
export class AtividadeEvento {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'quadro_id' })
  quadroId: number;

  @Column({ name: 'cartao_id', type: 'int', nullable: true })
  cartaoId: number | null;

  @Column({ type: 'varchar', length: 40 })
  tipo: TipoEventoAtividade;

  @Column({ type: 'text', default: '' })
  detalhe: string;

  @Column({ name: 'autor_usuario_id', type: 'int', nullable: true })
  autorUsuarioId: number | null;

  @Column({ name: 'autor_nome', length: 160, default: '' })
  autorNome: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
