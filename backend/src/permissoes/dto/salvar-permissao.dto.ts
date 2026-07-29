import { IsIn, IsInt, IsString } from 'class-validator';
import { PERFIS } from '../../common/constants/perfis';
import type { Perfil } from '../../common/constants/perfis';
import { NIVEIS } from '../../common/constants/menus';
import type { NivelPermissao } from '../../common/constants/menus';

export class SalvarPermissaoPapelDto {
  @IsIn(PERFIS)
  papel: Perfil;

  @IsString()
  menu: string;

  @IsIn(NIVEIS)
  nivel: NivelPermissao;
}

export class SalvarPermissaoUsuarioDto {
  @IsInt()
  usuarioId: number;

  @IsString()
  menu: string;

  /** 'nada'|'consulta'|'alteracao' para definir; a string 'herdar' remove a exceção. */
  @IsIn([...NIVEIS, 'herdar'])
  nivel: NivelPermissao | 'herdar';
}
