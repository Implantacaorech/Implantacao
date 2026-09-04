import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** De que lado da mesa o membro está. */
export type TipoMembro = 'interno' | 'cliente';

/** Membro de um cartão — e é ISTO que resolve "nível cliente × nível usuário do cliente"
 * (docs/controle-atividades.md §2.3):
 *
 * - cartão SEM membro do tipo `cliente` → tarefa da EMPRESA;
 * - cartão COM membro do tipo `cliente` → tarefa DAQUELA PESSOA.
 *
 * Um contato pode ser membro **sem ter conta no Painel** — por isso `usuarioId` é nulável e
 * o contato é identificado por e-mail. Quando o ADM liberar o acesso dele em
 * Sistema → Acesso de Clientes, o cartão já estará esperando. */
@Entity({ name: 'atividade_membros' })
@Index(['cartaoId', 'tipo'])
export class AtividadeMembro {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'cartao_id' })
  cartaoId: number;

  @Column({ type: 'varchar', length: 20 })
  tipo: TipoMembro;

  /** Usuário do Painel. Preenchido sempre no membro `interno`; no `cliente`, só quando o
   * contato já tem conta. */
  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ length: 160, default: '' })
  nome: string;

  /** E-mail do contato do SICLA — a identidade do membro `cliente` sem conta. Vazio no
   * membro `interno`. */
  @Column({ length: 200, default: '' })
  email: string;

  @Column({ length: 120, default: '' })
  cargo: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
