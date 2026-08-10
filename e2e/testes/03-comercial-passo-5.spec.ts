import { test, expect } from '@playwright/test';
import { entrarComSucesso, projetoNoPasso, token, USUARIOS } from '../apoio/painel';

/**
 * O passo 5 ("Avançar para finalização da negociação") é do COMERCIAL e não tem caminho
 * alternativo: nenhum `concluirAutomatico` o fecha, e a única rota é
 * `POST /projetos/:id/passos/5/concluir`.
 *
 * Ela exigia `@Permissao('carteira','alteracao')`, mas o Comercial tem nível `consulta` nesse
 * menu — então a API recusava (403), a tela escondia a coluna de ações inteira
 * (`soConsulta()`) e `GET /passos` ainda respondia `liberado: true`. Todo projeto travava no
 * passo 5 até um ADM concluir por fora (achado de 2026-08-05).
 *
 * A rota passou a exigir só `carteira` (consulta); quem decide é `PassosService.podeExecutar`,
 * que é mais estrito — exige o perfil responsável E a designação naquele projeto (RN-10).
 */
test.describe('Passo 5 — o Comercial conclui o próprio passo', () => {
  test('a API aceita a conclusão do passo 5 pelo Comercial', async ({ request }) => {
    const id = await projetoNoPasso(request, 'E2E Comercial API', 4);
    const tk = await token(request, USUARIOS.comercial);
    const r = await request.post(`/api/projetos/${id}/passos/5/concluir`, {
      headers: { Authorization: `Bearer ${tk}` },
      data: { observacao: 'Fechado em 12x', email: { para: ['adm@teste.local'], assunto: 'a', corpo: 'b' } },
      failOnStatusCode: false,
    });
    expect(r.status(), await r.text()).toBeLessThan(300);
  });

  test('a tela oferece ao Comercial a ação do passo 5', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Comercial Tela', 4);
    await entrarComSucesso(page, USUARIOS.comercial);
    await page.goto(`/projetos/${id}/passos`);

    const passo5 = page.locator('div.painel').filter({ hasText: 'Avançar para finalização da negociação' }).first();
    await expect(passo5).toBeVisible({ timeout: 15_000 });

    const acao = passo5.getByRole('button').filter({ hasText: /Concluir|Registrar|Redigir/ });
    expect(await acao.count(), 'o dono do passo tem de ter como executá-lo').toBeGreaterThan(0);
    await expect(acao.first()).toBeEnabled();
  });

  test('quem só consulta NÃO ganha ação num passo que não é seu', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'E2E Comercial Alheio', 8);
    await entrarComSucesso(page, USUARIOS.comercial);
    await page.goto(`/projetos/${id}/passos`);

    // Passo 10 é do GCI: liberado=false para o Comercial, logo a coluna de ação não aparece.
    const passo10 = page.locator('div.painel').filter({ hasText: 'Criação do Projeto' }).first();
    await expect(passo10).toBeVisible({ timeout: 15_000 });
    await expect(passo10.getByRole('button').filter({ hasText: /Concluir|Redigir|Registrar/ })).toHaveCount(0);
  });
});

/** O que o backend AFIRMA sobre um passo tem de bater com o que ele aceita. */
test('coerência: "liberado" e a conclusão contam a mesma história', async ({ request }) => {
  const id = await projetoNoPasso(request, 'E2E Coerencia Passo 5', 4);
  const tk = await token(request, USUARIOS.comercial);
  const cab = { Authorization: `Bearer ${tk}` };

  const lista = await (await request.get(`/api/projetos/${id}/passos`, { headers: cab })).json();
  const passo5 = (lista.data ?? lista).find((p: any) => p.numero === 5);

  const conclusao = await request.post(`/api/projetos/${id}/passos/5/concluir`, {
    headers: cab,
    data: { observacao: 'ok', email: { para: ['x@y.z'], assunto: 'a', corpo: 'b' } },
    failOnStatusCode: false,
  });

  expect(
    passo5.liberado && !conclusao.ok(),
    `GET /passos disse liberado=${passo5.liberado} motivos=${JSON.stringify(passo5.motivos)}, ` +
      `mas POST /concluir devolveu ${conclusao.status()}: ${await conclusao.text()}`,
  ).toBe(false);
});
