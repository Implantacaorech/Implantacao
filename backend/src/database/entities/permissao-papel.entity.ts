import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Perfil } from '../../common/constants/perfis';
import type { NivelPermissao } from '../../common/constants/menus';

/** Liberação PADRÃO por papel: qual nível (nada/consulta/alteracao) cada perfil tem sobre
 * cada menu/tela. Semeada em 2026-07-28 com as regras que estavam fixas no código; a partir
 * daí o painel de Permissões (Gestão) é a fonte da verdade. Exceções por usuário ficam em
 * `permissoes_usuario`. */
@Entity({ name: 'permissoes_papel' })
@Index(['papel', 'menu'], { unique: true })
export class PermissaoPapel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  papel: Perfil;

  @Column({ length: 40 })
  menu: string;

  @Column({ type: 'varchar', length: 12, default: 'nada' })
  nivel: NivelPermissao;
}
