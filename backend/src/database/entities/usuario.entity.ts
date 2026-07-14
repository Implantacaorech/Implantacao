import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Perfil } from '../../common/constants/perfis';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 120 })
  login: string;

  @Column({ length: 120, default: '' })
  nome: string;

  @Column({ length: 160, default: '' })
  email: string;

  // bcrypt — troca o hash werkzeug (scrypt/pbkdf2) do Flask; usuários existentes precisam
  // de reset de senha na virada (ver docs/migracao/03-documento-conversao.md).
  @Column({ name: 'senha_hash', type: 'text', default: '' })
  senhaHash: string;

  // type: 'varchar' explícito — com `import type` (exigido por isolatedModules), o
  // design:type refletido por decorator metadata vira "Object" em vez de String, e o
  // TypeORM não consegue inferir o tipo de coluna sozinho.
  @Column({ type: 'varchar', length: 20, default: 'Consultor' })
  perfil: Perfil;

  // código do técnico no SICLA — elo com o Agendador de Visitas
  @Column({ name: 'codigo_sicla', length: 40, default: '' })
  codigoSicla: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
