import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Permite revogar sessões (logout real, não só descartar o token no cliente). */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Index({ unique: true })
  @Column({ name: 'token_hash', length: 128 })
  tokenHash: string;

  @Column({ name: 'expira_em' })
  expiraEm: Date;

  @Column({ default: false })
  revogado: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
