import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissoesService } from '../services/permissoes.service';
import { temPapel } from '../constants/perfis';

/** Para onde vai o CLIENTE da Rech quando cai na raiz do Painel. */
export const ROTA_INICIAL_CLIENTE = '/bi/clientes-siger/resumo';

/** A "Visão Geral" (`/home`) é a porta de entrada de todo mundo de casa — e não é do
 * cliente: ela fala de carteira, designações e próximas ações da implantação. O usuário com
 * papel `Cliente` entra pelo MESMO endereço (decisão de 2026-08-31,
 * docs/acesso-cliente-bi.md) e precisa cair direto no BI, que é a única tela dele.
 *
 * Aplicado só na rota `home`, e transparente para qualquer papel interno.
 *
 * **O `podeVer` antes de redirecionar não é zelo — é o que evita um laço.** O destino tem
 * `permissaoGuard('bi_implantacao')`, que devolve quem não passa para `/home`. Se um
 * administrador tirar do papel `Cliente` a permissão do BI, redirecionar aqui sem conferir
 * produziria `/home` → BI → `/home` para sempre, e o navegador travaria em vez de mostrar
 * uma tela. Sem a permissão, o cliente fica na Visão Geral — que, para ele, vem vazia
 * (`soMeus` devolve lista vazia a papel externo). */
export const rotaInicialGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const perm = inject(PermissoesService);
  const router = inject(Router);
  if (!temPapel(auth.usuario(), 'Cliente')) return true;
  await perm.garantirCarregado();
  if (!perm.podeVer('bi_implantacao')) return true;
  return router.parseUrl(ROTA_INICIAL_CLIENTE);
};
