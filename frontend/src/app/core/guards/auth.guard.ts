import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PreferenciasService } from '../services/preferencias.service';

/** Impede navegação para telas protegidas sem sessão — só de conforto de UX; a autorização
 * de verdade é sempre revalidada pelo backend (JwtAuthGuard/RolesGuard), nunca só aqui.
 *
 * Aproveita para PRÉ-CARREGAR as preferências (filtros salvos) do usuário. É o único lugar
 * que roda antes de qualquer tela existir: com o mapa já em memória, cada tela restaura os
 * filtros de forma SÍNCRONA no construtor e a primeira carga de dados já sai com o recorte
 * certo — sem uma busca jogada fora nem piscada de conteúdo. Uma chamada por sessão. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const preferencias = inject(PreferenciasService);
  const router = inject(Router);
  if (!auth.autenticado()) return router.parseUrl('/login');
  await preferencias.garantirCarregado();
  return true;
};
