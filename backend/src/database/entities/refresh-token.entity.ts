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

  /** Por que foi revogado (M11 — detecção de reuso). `''` = ativo; `rotacao` = usado num
   * refresh (rotacionado); `logout` = saída explícita; `replay` = derrubado por reuso.
   * Distinguir `rotacao` de `logout` evita que uma aba velha reapresentando um token de
   * LOGOUT derrube os outros dispositivos do usuário — só o reuso de um token ROTACIONADO
   * (sinal de vazamento) escala para revogar a família. */
  @Column({ name: 'motivo_revogacao', length: 20, default: '' })
  motivoRevogacao: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
