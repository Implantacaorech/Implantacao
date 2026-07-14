import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Impede navegação para telas protegidas sem sessão — só de conforto de UX; a autorização
 * de verdade é sempre revalidada pelo backend (JwtAuthGuard/RolesGuard), nunca só aqui. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.autenticado()) return true;
  return router.parseUrl('/login');
};
