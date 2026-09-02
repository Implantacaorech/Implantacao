import { test, expect } from '@playwright/test';
import { entrarComSucesso, token, SENHA, USUARIOS } from '../apoio/painel';

/**
 * Acesso do CLIENTE ao BI "Implantação Clientes SIGER" (2026-08-31,
 * docs/acesso-cliente-bi.md). O cliente da Rech entra pelo MESMO endereço do consultor, com
 * um papel externo (`Cliente`) que enxerga uma tela só, recortada nele próprio.
 *
 * **O que este arquivo prova, e o que ele NÃO prova.** O recorte de LINHAS — que um cliente
 * não vê dado de outro — é provado em `conformidade-escopo-cliente.spec.ts` (backend), que
 * roda com dados mockados do SICLA e varre a resposta inteira atrás de vestígio alheio. Aqui
 * não haveria como: a instância isolada não tem Oracle, e o BI degrada com aviso em vez de
 * trazer linha nenhuma.
 *
 * O que só o navegador real prova, e é o que está aqui: a SESSÃO inteira do usuário-cliente —
 * o menu que ele recebe, a tela em que ele cai, as rotas que o roteador recusa, e as portas
 * que a API fecha para ele. É onde defeito de autorização costuma aparecer: não na consulta,
 * mas na tela que alguém esqueceu de esconder.
 */

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const dados = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

/** Os dois clientes semeados por `apoio/semear-usuarios.mjs`, em códigos diferentes. */
const CLIENTE = 'cliente.acme';
const OUTRO_CLIENTE = 'cliente.outro';

test.describe('Acesso do cliente — sessão e navegação', { tag: '@p0' }, () => {
  test('CT-084 — cai direto no BI: a Visão Geral não é tela dele', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    await expect(page).toHaveURL(/\/bi\/clientes-siger\/resumo/, { timeout: 15_000 });
  });

  test('CT-085 — o cabeçalho diz de que lado a pessoa está', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    await expect(page.locator('.topbar-lado')).toHaveText(/cliente/i);

    // E o consultor vê o rótulo oposto — o par é o que dá sentido aos dois.
    const outra = await page.context().browser()!.newContext();
    const pg = await outra.newPage();
    await entrarComSucesso(pg, USUARIOS.consultor);
    await expect(pg.locator('.topbar-lado')).toHaveText(/consultor/i);
    await outra.close();
  });

  test('CT-086 — o menu tem o BI e mais nada do processo', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    const menu = page.locator('.side-nav');
    // Casado por href, não por texto: o nome acessível do link inclui a dica do tooltip
    // (`side-tip`), então bater por rótulo é frágil.
    await expect(menu.locator('a[href="/bi"]')).toBeVisible();

    // A carteira, os projetos e a área de Sistema são assunto interno da Rech.
    for (const rota of ['/projetos', '/clientes/novo', '/coordenacao', '/usuarios', '/permissoes']) {
      await expect(
        menu.locator(`a[href="${rota}"]`),
        `o menu do cliente não pode oferecer ${rota}`,
      ).toHaveCount(0);
    }
  });

  // A aba "BI Implantação" (chave `dashboards`) é o BI INTERNO e divide a mesma entrada de
  // menu com o do cliente. Se ela aparecesse, o cliente teria um caminho para dados da Rech.
  test('CT-087 — dentro da área BI, só a aba do BI de clientes', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    const abas = page.locator('.bi-abas-top');
    await expect(abas.getByRole('link', { name: /Implantação Clientes SIGER/i })).toBeVisible();
    await expect(abas.getByRole('link', { name: /^BI Implantação$/ })).toHaveCount(0);
  });

  test('CT-088 — rota interna digitada na barra de endereço não abre', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    for (const rota of ['/projetos', '/usuarios', '/permissoes', '/bi/implantacao']) {
      await page.goto(rota);
      await expect(page, `rota ${rota} não podia abrir para o cliente`).not.toHaveURL(
        new RegExp(rota.replace('/', '\\/')),
        { timeout: 10_000 },
      );
    }
  });

  test('CT-089 — as 4 subabas do BI abrem para o cliente', async ({ page }) => {
    await entrarComSucesso(page, CLIENTE);
    for (const sub of ['resumo', 'extrato', 'rns', 'agendas']) {
      await page.goto(`/bi/clientes-siger/${sub}`);
      await expect(page).toHaveURL(new RegExp(`clientes-siger/${sub}`), { timeout: 10_000 });
    }
  });
});

test.describe('Acesso do cliente — o que a API fecha', { tag: '@p0' }, () => {
  test('CT-090 — endpoints internos respondem 403 ao cliente', async ({ request }) => {
    const tk = await token(request, CLIENTE);
    for (const rota of ['/api/projetos', '/api/usuarios', '/api/permissoes/matriz']) {
      const r = await request.get(rota, { headers: cab(tk), failOnStatusCode: false });
      expect(r.status(), `${rota} devia recusar o cliente`).toBeGreaterThanOrEqual(400);
    }
  });

  // Envio é ferramenta interna: as linhas do PDF vêm do CORPO do pedido e o destinatário é
  // livre — para um usuário externo seria um relay de e-mail saindo do domínio da Rech, com
  // conteúdo escolhido por ele.
  test('CT-091 — o envio por e-mail do painel de visitas é negado ao cliente', async ({ request }) => {
    const tk = await token(request, CLIENTE);
    // Payload COMPLETO de propósito: a recusa vive no serviço, que roda depois do
    // ValidationPipe — faltando um campo do DTO, a resposta seria 400 (validação) e o teste
    // não provaria nada sobre autorização.
    const r = await request.post('/api/bi-implantacao/visitas-portal/enviar-email', {
      headers: cab(tk),
      data: {
        para: 'qualquer@fora.com', assunto: 'a', corpo: 'b',
        recorte: ['Período: 01/08 a 31/08'], linhas: [],
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(403);

    const modelo = await request.get('/api/bi-implantacao/visitas-portal/modelo-email', {
      headers: cab(tk), failOnStatusCode: false,
    });
    expect(modelo.status()).toBe(403);
  });

  // O consultor continua com o botão — a restrição é do papel externo, não da rota.
  test('CT-092 — e continua liberado para quem é da casa', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.get('/api/bi-implantacao/visitas-portal/modelo-email', {
      headers: cab(tk), failOnStatusCode: false,
    });
    expect(r.status()).toBe(200);
  });

  // O BI do cliente ABRE (mesmo sem Oracle na instância isolada, onde degrada com aviso) —
  // o contrário do 403 acima, e o que garante que o gate não fechou demais.
  test('CT-093 — o BI responde ao cliente', async ({ request }) => {
    const tk = await token(request, CLIENTE);
    const r = await request.get('/api/bi-implantacao/resumo', { headers: cab(tk) });
    expect(r.status()).toBe(200);
  });

  /** O escopo sai da IDENTIDADE, nunca do pedido: um `?cliente=` forjado é sobrescrito, não
   * recusado — recusar revelaria que o outro código existe. Sem Oracle não dá para comparar
   * linhas, mas dá para provar que o parâmetro não derruba nem altera o contrato da resposta
   * (o recorte em si está em `conformidade-escopo-cliente.spec.ts`). */
  test('CT-094 — filtro de cliente forjado não muda a resposta', async ({ request }) => {
    const tk = await token(request, CLIENTE);
    const limpo = await request.get('/api/bi-implantacao/extrato', { headers: cab(tk) });
    const forjado = await request.get('/api/bi-implantacao/extrato?cliente=CONCORRENTE', {
      headers: cab(tk), failOnStatusCode: false,
    });
    expect(forjado.status()).toBe(limpo.status());
    expect(dados(await forjado.json()).linhas).toEqual(dados(await limpo.json()).linhas);
  });
});

test.describe('Acesso do cliente — o cadastro não deixa nascer usuário inseguro', { tag: '@p0' }, () => {
  /** As duas regras que tornam "usuário-cliente sem escopo" inexistente, em vez de um caso a
   * tratar depois em cada consulta. O service tem os testes unitários; aqui é a borda HTTP,
   * que é por onde a tela de Usuários passa. */
  test('CT-095 — cliente SEM código de cliente é recusado', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.post('/api/usuarios', {
      headers: cab(tk),
      data: {
        login: 'cliente.sem.vinculo', nome: 'Cliente Sem Vinculo',
        email: 'sem.vinculo@teste.local', senha: SENHA, perfil: 'Cliente',
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  // Acumular `Cliente` com papel interno seria a porta de saída do recorte: o usuário cairia
  // no ramo "interno vê tudo" de toda verificação de escopo.
  test('CT-096 — cliente acumulado com papel interno é recusado', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.post('/api/usuarios', {
      headers: cab(tk),
      data: {
        login: 'cliente.misto', nome: 'Cliente Misto', email: 'misto@teste.local',
        senha: SENHA, perfil: 'Cliente', perfis: ['Cliente', 'Consultor'],
        codigoClienteSicla: '4001',
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  test('CT-097 — e o cadastro válido passa', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.post('/api/usuarios', {
      headers: cab(tk),
      data: {
        login: `cliente.valido.${Date.now()}`, nome: `Cliente Valido ${Date.now()}`,
        email: `valido.${Date.now()}@teste.local`, senha: SENHA,
        perfil: 'Cliente', codigoClienteSicla: '4002',
      },
      failOnStatusCode: false,
    });
    expect(r.status()).toBeLessThan(300);
  });
});

test.describe('Acesso do cliente — o interno não é afetado', { tag: '@p0' }, () => {
  test('CT-098 — o consultor continua caindo na Visão Geral', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.consultor);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test('CT-099 — e um cliente não enxerga a sessão do outro', async ({ request }) => {
    // Os dois logam e cada um recebe o próprio token — o que separa os dois é o vínculo no
    // banco, não o que o navegador manda.
    const a = await token(request, CLIENTE);
    const b = await token(request, OUTRO_CLIENTE);
    expect(a).not.toBe(b);
    for (const tk of [a, b]) {
      const r = await request.get('/api/bi-implantacao/resumo', { headers: cab(tk) });
      expect(r.status()).toBe(200);
    }
  });
});

/** A tela por onde o ADM concede o acesso: Sistema → Acesso de Clientes. A lista de quem
 * PODE receber acesso vem do SICLA (`LISTA_CONTATOS`, `PORTAL_RECH_CLIENTES = 1`) — nesta
 * instância não há Oracle, então o que se prova aqui é o gate e a moldura, não a listagem. */
test.describe('Acesso de Clientes — a tela do ADM', { tag: '@p1' }, () => {
  test('CT-100 — abre para o ADM, com a origem declarada na própria tela', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto('/acesso-clientes');
    await expect(page).toHaveURL(/acesso-clientes/);
    await expect(page.getByRole('heading', { name: /Acesso de Clientes/i })).toBeVisible();
    // Quem autoriza é o SICLA — a tela precisa dizer isso a quem opera, senão parece que a
    // liberação nasce aqui.
    await expect(page.locator('body')).toContainText('PORTAL_RECH_CLIENTES');
  });

  test('CT-101 — o menu do ADM oferece a tela', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.adm);
    await expect(
      page.locator('.side-nav').locator('a[href="/acesso-clientes"]'),
    ).toBeVisible();
  });

  test('CT-102 — não abre para quem não é ADM — nem pela URL, nem no menu', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.coordenador);
    await expect(
      page.locator('.side-nav').locator('a[href="/acesso-clientes"]'),
    ).toHaveCount(0);
    await page.goto('/acesso-clientes');
    await expect(page).not.toHaveURL(/acesso-clientes/, { timeout: 10_000 });
  });

  test('CT-103 — e a API recusa quem não é ADM', async ({ request }) => {
    for (const login of [USUARIOS.coordenador, CLIENTE]) {
      const tk = await token(request, login);
      const r = await request.get('/api/contatos-sicla?cliente=3180', {
        headers: cab(tk), failOnStatusCode: false,
      });
      expect(r.status(), `${login} não podia listar contatos`).toBeGreaterThanOrEqual(400);
    }
  });

  // Sem Oracle a listagem não vem; o que não pode é a tela fingir "nenhum contato liberado",
  // que leria como decisão do SICLA em vez de falha de conexão.
  test('CT-104 — sem SICLA, o ADM recebe a mensagem da conexão — não uma lista vazia', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.get('/api/contatos-sicla?cliente=3180', { headers: cab(tk) });
    expect(r.status()).toBe(200);
    const corpo = dados(await r.json());
    expect(corpo.ok).toBe(false);
    expect(corpo.mensagem).toBeTruthy();
  });
});
