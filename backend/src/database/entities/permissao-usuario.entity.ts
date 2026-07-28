import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { NivelPermissao } from '../../common/constants/menus';

/** EXCEÇÃO por usuário: sobrepõe o padrão do papel (`permissoes_papel`) para um usuário
 * específico num menu. Só existe linha aqui quando há exceção — na ausência, vale o papel.
 * (Definição do usuário em 2026-07-28: "por Papel + exceção por usuário".) */
@Entity({ name: 'permissoes_usuario' })
@Index(['usuarioId', 'menu'], { unique: true })
export class PermissaoUsuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'usuario_id' })
  usuarioId: number;

  @Column({ length: 40 })
  menu: string;

  @Column({ type: 'varchar', length: 12, default: 'nada' })
  nivel: NivelPermissao;
}
