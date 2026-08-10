import { test, expect } from '@playwright/test';
import { entrar, entrarComSucesso, USUARIOS } from '../apoio/painel';

test.describe('Acesso ao Painel', () => {
  test('login válido entra e sai da tela de login', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.adm);
    await expect(page.locator('body')).not.toContainText('Entrar', { timeout: 5_000 });
  });

  test('senha errada não entra e mostra o erro na tela', async ({ page }) => {
    await entrar(page, USUARIOS.adm, 'senha-errada');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.resultado.erro')).toBeVisible();
  });

  test('usuário inexistente não entra', async ({ page }) => {
    await entrar(page, 'nao-existe-mesmo');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rota protegida sem login cai no login', async ({ page }) => {
    await page.goto('/projetos/1/passos');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('deep link recarregado continua funcionando (fallback de SPA)', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto('/projetos');
    await page.reload();
    await expect(page).toHaveURL(/\/projetos/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
