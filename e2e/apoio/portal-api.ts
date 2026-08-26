import { APIRequestContext } from '@playwright/test';

/**
 * Endereço da instância **Portal API** sob teste.
 *
 * Desde 2026-08-26 a administração da API de Dados (catálogo, conexões, consultas e tokens)
 * existe **só** no Portal API — o Painel monta o `DadosModule` para executar, mas não os
 * controllers de `/admin`. Por isso estes casos deixaram de rodar contra a 5199: lá eles
 * passariam a receber 404 e provariam o oposto do que afirmam.
 *
 * ⚠️ NUNCA aponte para a 5110: é o Portal API **de produção**, com a credencial real do
 * Oracle. Estes testes criam e apagam clientes de máquina e consultas.
 */
const PADRAO = 'http://localhost:5198';
export const PORTAL_API = process.env.PORTAL_API_E2E_URL ?? PADRAO;

if (/:5110(\/|$)/.test(PORTAL_API)) {
  throw new Error(
    `PORTAL_API_E2E_URL aponta para ${PORTAL_API} — a 5110 é o Portal API em PRODUÇÃO. ` +
      'Suba a instância isolada na 5198 (e2e/README.md).',
  );
}

/** A instância respondeu E se declara `portal-api`?
 *
 * A pergunta é feita à INSTÂNCIA, não ao repositório — mesma razão de `insumo-local.ts`:
 * uma guarda que olhasse o disco acertaria no CI e erraria em qualquer máquina cuja
 * instância esteja parada por outro motivo. E conferir o `perfil` evita o pior dos enganos:
 * apontar sem querer para um Painel e concluir que "a administração não existe" quando ela
 * existe, só que noutro lugar.
 */
export async function portalApiNoAr(request: APIRequestContext): Promise<boolean> {
  try {
    const r = await request.get(`${PORTAL_API}/api/instancia`, {
      failOnStatusCode: false,
      timeout: 5_000,
    });
    if (!r.ok()) return false;
    const corpo = await r.json();
    return (corpo?.data ?? corpo)?.perfil === 'portal-api';
  } catch {
    return false;
  }
}

export const SEM_PORTAL_API =
  `nenhuma instância Portal API respondeu em ${PORTAL_API} — a administração da API de ` +
  'Dados só existe lá, então o caso é PULADO em vez de falhar. Suba-a com ' +
  'MIGRACAO_DADOS_PORT=5198 (ver e2e/README.md).';
