import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissoesService } from '../services/permissoes.service';

/** Guard por MENU do painel de Permissões (client-side, UX). Garante o mapa carregado e
 * bloqueia a navegação quando o usuário não tem acesso (nível 'nada') ao menu. A autorização
 * de verdade é sempre revalidada pelo backend (PermissaoGuard). Uso:
 * `canActivate: [permissaoGuard('matriz')]`. */
export function permissaoGuard(menu: string): CanActivateFn {
  return async () => {
    const perm = inject(PermissoesService);
    const router = inject(Router);
    await perm.garantirCarregado();
    if (perm.podeVer(menu)) return true;
    return router.parseUrl('/home');
  };
}
