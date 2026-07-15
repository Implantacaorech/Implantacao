import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Perfil } from '../models/auth-user.model';

/** Fábrica de guard por perfil — bloqueia navegação (client-side, conforto de UX) quando
 * o perfil do usuário logado não está entre os `perfis` permitidos. Mesmo espírito de
 * `authGuard`: a autorização de verdade é sempre revalidada pelo backend (RolesGuard),
 * nunca só aqui. Uso: `canActivate: [perfilGuard('ADM', 'Coordenador')]`. */
export function perfilGuard(...perfis: Perfil[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const perfil = auth.usuario()?.perfil;
    if (perfil && perfis.includes(perfil)) return true;
    return router.parseUrl('/home');
  };
}
