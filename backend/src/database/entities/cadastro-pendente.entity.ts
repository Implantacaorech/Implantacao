import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Auto-cadastro em andamento: aguardando confirmação do código de 6 dígitos enviado por
 * e-mail. Vira um `Usuario` real (perfil `Consultor`, sempre) só na confirmação. Espelha
 * webapp/db.py:CadastroPendente. */
@Entity({ name: 'cadastros_pendentes' })
export class CadastroPendente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120, default: '' })
  nome: string;

  @Column({ length: 120, default: '' })
  login: string;

  @Index()
  @Column({ length: 160, default: '' })
  email: string;

  @Column({ name: 'senha_hash', type: 'text', default: '' })
  senhaHash: string;

  @Column({ name: 'codigo_sicla', length: 40, default: '' })
  codigoSicla: string;

  @Column({ length: 6, default: '' })
  codigo: string;

  @Column({ default: 0 })
  tentativas: number;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
