import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { TipoMembro } from './atividade-membro.entity';

/** Comentário num cartão — onde consultor e cliente conversam.
 *
 * `autorTipo` é gravado no momento do comentário (e não derivado do usuário na leitura) para
 * o histórico não mudar de lado se o cadastro do autor mudar depois. */
@Entity({ name: 'atividade_comentarios' })
@Index(['cartaoId', 'criadoEm'])
export class AtividadeComentario {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'cartao_id' })
  cartaoId: number;

  @Column({ name: 'autor_usuario_id', type: 'int', nullable: true })
  autorUsuarioId: number | null;

  @Column({ name: 'autor_nome', length: 160, default: '' })
  autorNome: string;

  @Column({
    name: 'autor_tipo',
    type: 'varchar',
    length: 20,
    default: 'interno',
  })
  autorTipo: TipoMembro;

  @Column({ type: 'text' })
  texto: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
