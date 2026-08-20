import { test, expect } from '@playwright/test';
import { SENHA, USUARIOS, entrarComSucesso, projetoNoPasso, token } from '../apoio/painel';

/** GCI DESIGNADO pelo `projetoNoPasso` — é dele o passo 10 neste projeto. Entrar com o `gci`
 * genérico abre a tela (a permissão de PERFIL basta para isso), mas a RN-10 não deixa ele
 * concluir passo de projeto alheio: o documento é gravado e o passo continua aberto. */
const GCI_DESIGNADO = 'gabriel.gci';

/**
 * Etapa 10 (Criação do Projeto) herda a etapa 3 (Levantamento de Processo).
 *
 * REGRA DE NEGÓCIO (usuário, 2026-08-20): o Projeto de Implantação não é redigido do zero —
 * ele nasce do que foi levantado na etapa 3. O GCI entra na tela do passo 10 com tudo já
 * preenchido, revisa e ajusta o que for necessário, e só então gera o documento; aí o passo
 * 11 (o Administrativo confere e manda o cliente assinar) faz sentido.
 *
 * Antes disso o passo 10 abria direto em "Gerar Projeto": o .docx saía sem ninguém revisar
 * o que veio do levantamento, e a tela de edição — que existia — abria em branco, obrigando
 * a redigitar. É o defeito que estes casos impedem de voltar.
 *
 * Os campos são localizados pelo RÓTULO (getByRole), não por `[name=...]`: na tela o `name`
 * é consumido pela diretiva `NgModel` do Angular como input e não chega ao DOM, então um
 * seletor por atributo não acha nada aqui.
 */
test.describe('Etapa 10 — o Projeto herda o Levantamento da etapa 3', () => {
  const cab = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Preenche a etapa 3 do projeto pela API — preparar estado não é o que está sob teste. */
  async function preencherEtapa3(request: any, id: number) {
    const adm = await token(request, USUARIOS.adm);
    await request.put(`/api/projetos/${id}/doc-conteudo/levantamento`, {
      headers: cab(adm),
      data: {
        objetivos: 'Padronizar o faturamento e o controle de estoque.',
        filiais: 'Matriz em Novo Hamburgo e filial em Campo Bom.',
        usu_0_nome: 'Fulano da Silva',
        usu_0_email: 'fulano@cliente.com.br',
        usu_0_atrib: 'Faturamento',
      },
    });
  }

  test('o passo 10 abre a tela de EDIÇÃO, não a geração direta', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'Cliente Herança Etapa 10', 9);
    await entrarComSucesso(page, USUARIOS.gci);
    await page.goto(`/projetos/${id}/passos`);

    const passo10 = page.locator('div.painel').filter({ hasText: 'Criação do Projeto' }).first();
    await expect(passo10).toBeVisible({ timeout: 15_000 });
    await passo10.getByRole('link', { name: /abrir/i }).click();

    // O destino do passo 10 mudou de 'projeto/origem' para a edição estruturada: é ali que o
    // GCI revisa o levantamento antes de o cliente receber o documento para assinar.
    await expect(page).toHaveURL(new RegExp(`/projetos/${id}/editar/projeto`), { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Projeto de Implantação/i);
  });

  test('a tela do passo 10 abre com os dados da etapa 3 e o GCI edita antes de gerar', async ({
    page,
    request,
  }) => {
    const id = await projetoNoPasso(request, 'Cliente Herança Campos', 9);
    await preencherEtapa3(request, id);

    await entrarComSucesso(page, USUARIOS.gci);
    await page.goto(`/projetos/${id}/editar/projeto`);

    // Herdado da etapa 3 — a tela NÃO abre em branco.
    const objetivos = page.getByRole('textbox', { name: 'Objetivos do projeto' });
    await expect(objetivos).toHaveValue(
      'Padronizar o faturamento e o controle de estoque.',
      { timeout: 15_000 },
    );
    await expect(
      page.getByRole('textbox', { name: 'Empresas contempladas no projeto' }),
    ).toHaveValue('Matriz em Novo Hamburgo e filial em Campo Bom.');
    // "Módulos previstos" da área sai dos módulos contratados, não digitado à mão.
    await expect(
      page.getByRole('textbox', { name: 'Módulos previstos' }).first(),
    ).toHaveValue(/FAT/);

    const tabela = page.locator('div.painel').filter({ hasText: 'Tabela de Usuários' }).first();
    const linhas = tabela.locator('tbody tr');
    // 5 linhas: com 4, o 5º usuário-chave levantado na etapa 3 sumia sem aviso.
    await expect(linhas).toHaveCount(5);
    await expect(linhas.nth(0).locator('input').nth(0)).toHaveValue('Fulano da Silva');
    await expect(linhas.nth(0).locator('input').nth(1)).toHaveValue('fulano@cliente.com.br');
    // "Atribuições" do levantamento vira "Área de Atuação no SIGER" no Projeto.
    await expect(linhas.nth(0).locator('input').nth(2)).toHaveValue('Faturamento');

    // O GCI ajusta o que precisa e o valor dele passa a valer.
    await objetivos.fill('Objetivos revisados pelo GCI antes da assinatura.');
    await page.getByRole('button', { name: /^Salvar$/ }).click();
    await expect(page.locator('.resultado.ok')).toContainText('Salvo.', { timeout: 15_000 });

    await page.reload();
    await expect(
      page.getByRole('textbox', { name: 'Objetivos do projeto' }),
    ).toHaveValue('Objetivos revisados pelo GCI antes da assinatura.', {
      timeout: 15_000,
    });
  });

  test('gerar pela tela de edição conclui o passo 10 e libera o 11', async ({ page, request }) => {
    const id = await projetoNoPasso(request, 'Cliente Herança Gera', 9);
    await preencherEtapa3(request, id);

    await entrarComSucesso(page, GCI_DESIGNADO);
    await page.goto(`/projetos/${id}/editar/projeto`);
    await expect(
      page.getByRole('textbox', { name: 'Objetivos do projeto' }),
    ).toHaveValue('Padronizar o faturamento e o controle de estoque.', {
      timeout: 15_000,
    });

    const baixa = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /Salvar e gerar o Projeto/i }).click();
    const arquivo = await baixa;
    expect(arquivo.suggestedFilename()).toMatch(/\.docx$/);

    // Gerar é o fecho do passo 10 — a tela volta para a ficha e o passo aparece concluído.
    // A marca é "Concluído por <fulano>", não um /conclu/i solto: esse casaria com o próprio
    // botão "Concluir" e o teste passaria com o passo ainda aberto.
    await page.goto(`/projetos/${id}/passos`);
    const passo10 = page.locator('div.painel').filter({ hasText: 'Criação do Projeto' }).first();
    await expect(passo10).toContainText(/Concluído por/i, { timeout: 15_000 });
    await expect(passo10).toContainText('Gabriel GCI');

    // E o 11 (Administrativo confere e envia para assinatura) deixa de estar travado. O
    // cartão SEMPRE exibe "Depende do passo 10" como informação (RN-3), então quem diz se
    // liberou é o botão de ação: `[disabled]="!p.liberado"` na tela. Quem responde pelo 11 é
    // o Administrativo — é com o login dele que a liberação aparece.
    await entrarComSucesso(page, USUARIOS.administrativo);
    await page.goto(`/projetos/${id}/passos`);
    const passo11 = page
      .locator('div.painel')
      .filter({ hasText: 'Conferência do Projeto' })
      .first();
    await expect(passo11.getByRole('button', { name: /Redigir e-mail/i })).toBeEnabled({
      timeout: 15_000,
    });
  });

  test('o Levantador vê o botão do passo 10 e a tela o aceita (o botão não promete o que a tela recusa)', async ({
    page,
    request,
  }) => {
    // PERFIS_TELA_DO_PASSO[10] inclui o Levantador no backend; enquanto o perfilGuard da rota
    // não o incluía, ele via "Abrir" e caía fora. É o mesmo defeito de 2026-07-29 no passo 3.
    const id = await projetoNoPasso(request, 'Cliente Herança Levantador', 9);
    await entrarComSucesso(page, USUARIOS.levantador);
    await page.goto(`/projetos/${id}/editar/projeto`);

    await expect(page).toHaveURL(new RegExp(`/projetos/${id}/editar/projeto`), { timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Projeto de Implantação/i);
  });
});

test.describe('Etapa 10 — senha padrão da instância isolada', () => {
  test('sanidade: a suíte está na instância descartável, não em produção', async ({ request }) => {
    expect(SENHA).toBe('Teste@123');
    const r = await request.get('/api/health');
    const j = await r.json();
    expect(j.data.db).toBe('better-sqlite3');
  });
});
