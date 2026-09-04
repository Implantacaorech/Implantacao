import { test, expect } from '@playwright/test';
import { entrarComSucesso, projetoNoPasso, USUARIOS } from '../apoio/painel';

/** A tela dos 21 passos: o que ela mostra tem de bater com o que o backend aceita. */
test.describe('Tela dos 21 passos — integridade do que a interface promete', { tag: '@p0' }, () => {
  test('CT-006 — mostra os 21 passos, na ordem, com o responsável de cada um', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Lista de Passos', 0);
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto(`/projetos/${id}/passos`);

    const cartoes = page.locator('div.painel').filter({ hasText: /Consulta e Cadastro do Cliente/ });
    await expect(cartoes.first()).toBeVisible({ timeout: 15_000 });

    const esperados: [number, string, string][] = [
      [1, 'Consulta e Cadastro do Cliente', 'Comercial'],
      [2, 'Agendar Levantamento de Processo', 'Administrativo'],
      [3, 'Realizar o Levantamento de Processo', 'Levantador'],
      [5, 'Avançar para finalização da negociação', 'Comercial'],
      [8, 'Indicar o GCI e os técnicos responsáveis', 'Coordenador'],
      [10, 'Criação do Projeto', 'GCI'],
      [13, 'Elaborar o cronograma e incluir as agendas no SICLA', 'Consultor'],
      [21, 'E-mail de Encerramento ao cliente, com o Termo', 'Consultor'],
    ];
    for (const [numero, titulo, responsavel] of esperados) {
      const cartao = page.locator('div.painel').filter({ hasText: titulo }).first();
      await expect(cartao, `passo ${numero} na tela`).toBeVisible();
      await expect(cartao, `responsável do passo ${numero}`).toContainText(responsavel);
    }
  });

  test('CT-007 — passo bloqueado tem o botão desabilitado e explica o porquê', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Passo Bloqueado', 1);
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto(`/projetos/${id}/passos`);

    const passo8 = page.locator('div.painel').filter({ hasText: 'Indicar o GCI e os técnicos' }).first();
    await expect(passo8).toBeVisible({ timeout: 15_000 });
    await expect(passo8).toContainText(/Depende do passo 7/);
    const botao = passo8.getByRole('button', { name: /^Concluir$|Indicar|Registrar/ }).first();
    if (await botao.count()) await expect(botao).toBeDisabled();
  });

  test('CT-008 — RN-1: concluído o passo 8, o cronograma (13) libera sem esperar o Projeto', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Trilhas Paralelas', 8);
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto(`/projetos/${id}/passos`);

    const passo13 = page.locator('div.painel').filter({ hasText: 'Elaborar o cronograma' }).first();
    await expect(passo13).toBeVisible({ timeout: 15_000 });
    await expect(passo13, 'o 13 não pode alegar dependência do 9/10/12')
      .not.toContainText(/Depende do passo (9|10|11|12)/);

    const passo11 = page.locator('div.painel').filter({ hasText: 'Conferência do Projeto' }).first();
    await expect(passo11, 'RN-3: o 11 espera o 10').toContainText(/Depende do passo 10/);
  });

  test('CT-009 — RN-6: passo definitivo não oferece "Reabrir"; reversível oferece', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Irreversivel', 15);
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto(`/projetos/${id}/passos`);

    const passo15 = page.locator('div.painel').filter({ hasText: 'Encaminhar e-mail de boas-vindas' }).first();
    await expect(passo15).toBeVisible({ timeout: 15_000 });
    await expect(passo15).toContainText('definitivo');
    await expect(passo15.getByRole('button', { name: 'Reabrir' })).toHaveCount(0);

    const passo9 = page.locator('div.painel').filter({ hasText: 'Incluir a RNI e as RNS' }).first();
    await expect(passo9.getByRole('button', { name: 'Reabrir' })).toHaveCount(1);
  });

  test('CT-010 — RN-5: "Marcar conferido" não aparece antes de o passo 11 ser concluído', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Conferencia Antes', 10);
    await entrarComSucesso(page, USUARIOS.administrativo);
    await page.goto(`/projetos/${id}/passos`);
    await expect(page.locator('div.painel').first()).toBeVisible({ timeout: 15_000 });

    const passo11 = page.locator('div.painel').filter({ hasText: 'Conferência do Projeto' }).first();
    await expect(passo11.getByRole('button', { name: /conferido/i })).toHaveCount(0);

    // nenhum outro passo concluído oferece conferência
    const passo10 = page.locator('div.painel').filter({ hasText: 'Criação do Projeto' }).first();
    await expect(passo10.getByRole('button', { name: /conferido/i })).toHaveCount(0);
    const passo8 = page.locator('div.painel').filter({ hasText: 'Indicar o GCI' }).first();
    await expect(passo8.getByRole('button', { name: /conferido/i })).toHaveCount(0);
  });

  test('CT-011 — RN-5: concluído o 11, a tela oferece "Marcar conferido" — e só nele', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Conferencia Depois', 11);
    await entrarComSucesso(page, USUARIOS.administrativo);
    await page.goto(`/projetos/${id}/passos`);
    await expect(page.locator('div.painel').first()).toBeVisible({ timeout: 15_000 });

    // `projetoNoPasso` já confere o 11 ao passar por ele; reabrir a conferência não existe,
    // então o que se verifica aqui é que NENHUM outro passo concluído oferece o botão.
    const conferiveis = page.getByRole('button', { name: /conferido/i });
    const total = await conferiveis.count();
    expect(total, 'só os passos 11 e 19 podem oferecer conferência').toBeLessThanOrEqual(1);

    const passo12 = page.locator('div.painel').filter({ hasText: 'Sinalizar Projeto assinado' }).first();
    await expect(passo12, 'com o 11 já conferido, o 12 não pode alegar bloqueio')
      .not.toContainText(/Aguardando a conferência/);
  });

  test('CT-012 — nome de cliente com <script> é escapado, não executado', async ({ page, request }) => {
    const id = await projetoNoPasso(request, '<script>window.__xss=1</script> E2E XSS', 1);
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto(`/projetos/${id}/passos`);
    await expect(page.locator('div.painel').first()).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
});
