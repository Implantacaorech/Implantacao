import { defineConfig, devices } from '@playwright/test';

/**
 * Testes ponta a ponta do Painel de Implantação — navegador real contra a interface real.
 *
 * ⚠️ NUNCA aponte para a porta 5100: é o Painel em PRODUÇÃO. Estes testes concluem passos,
 * criam projetos e disparam e-mails. O alvo padrão é a **instância isolada** da porta 5199
 * (SQLite descartável, sem SMTP configurado — ver `e2e/README.md`).
 *
 * Sobrescreva com PAINEL_E2E_URL só para outra instância de teste.
 */
const BASE = process.env.PAINEL_E2E_URL ?? 'http://localhost:5199';

if (/:5100(\/|$)/.test(BASE)) {
  throw new Error(
    `PAINEL_E2E_URL aponta para ${BASE} — a porta 5100 é o Painel em PRODUÇÃO. ` +
      'Suba a instância isolada (e2e/README.md) e use a 5199.',
  );
}

export default defineConfig({
  testDir: './testes',
  // Serial: os testes caminham pelo MESMO projeto ao longo do fluxo, e o processo de
  // implantação é sequencial por natureza — paralelizar embaralharia o estado dos passos.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'relatorio' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
