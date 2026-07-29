import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Perfil } from '../models/auth-user.model';
import { temPapel } from '../constants/perfis';

/** Fábrica de guard por perfil — bloqueia navegação (client-side, conforto de UX) quando
 * o usuário logado não tem NENHUM dos `perfis` permitidos. Mesmo espírito de `authGuard`:
 * a autorização de verdade é sempre revalidada pelo backend (RolesGuard), nunca só aqui.
 * Uso: `canActivate: [perfilGuard('ADM', 'Coordenador')]`.
 *
 * Avalia TODOS os papéis do usuário (`perfis`), não só o principal — igual ao RolesGuard do
 * backend. Antes, quem era Coordenador com perfil PRINCIPAL "Consultor" era mandado de
 * volta pra /home numa rota que o backend liberaria (correção de 2026-07-28). */
export function perfilGuard(...perfis: Perfil[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (temPapel(auth.usuario(), ...perfis)) return true;
    return router.parseUrl('/home');
  };
}
