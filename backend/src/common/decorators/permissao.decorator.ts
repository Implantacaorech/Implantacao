import { SetMetadata } from '@nestjs/common';
import { NivelPermissao } from '../constants/menus';

export const PERMISSAO_KEY = 'permissao';

export interface PermissaoMeta {
  menu: string;
  /** Nível mínimo exigido (default 'consulta' = basta ter acesso à tela). */
  nivel: NivelPermissao;
}

/** Gate por MENU do painel de Permissões — resolvido em runtime contra o banco
 * (PermissaoGuard). `nivel` default 'consulta' (basta ver a tela); use 'alteracao' para
 * rotas de escrita. Sobrepõe o antigo @Roles nas telas controladas pelo painel. */
export const Permissao = (menu: string, nivel: NivelPermissao = 'consulta') =>
  SetMetadata(PERMISSAO_KEY, { menu, nivel } as PermissaoMeta);
