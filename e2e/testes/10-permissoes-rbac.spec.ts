import { test, expect, APIRequestContext } from '@playwright/test';
import { USUARIOS, entrarComSucesso, token } from '../apoio/painel';

/**
 * Painel de Permissões (Gestão → Permissões) — o RBAC deixou de ser fixo no código em
 * 2026-07-28 e passou a ser dirigido pelo banco. O que estes casos provam é a AMARRAÇÃO:
 * mexer na matriz muda, na mesma hora, as três coisas que dependem dela — o mapa que o
 * Angular lê (`/permissoes/me`), o item no menu lateral e a resposta da API por baixo da
 * tela. Enquanto isso não é testado ponta a ponta, um engano na matriz não dá erro: dá
 * acesso indevido, calado.
 *
 * O menu escolhido para mexer é `rns` (Execução → RNS), de propósito: é só leitura do SICLA
 * e nenhum outro caso da suíte depende dele. Toda alteração é revertida no `finally`.
 */

const MENU = 'rns';
const PAPEL = 'Levantador';

const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

async function nivelDoMenu(request: APIRequestContext, login: string, menu: string) {
  const t = await token(request, login);
  const r = await request.get('/api/permissoes/me', {
    headers: { Authorization: `Bearer ${t}` },
  });
  expect(r.ok(), '/permissoes/me deve responder a qualquer autenticado').toBeTruthy();
  return desembrulhar(await r.json()).niveis?.[menu] ?? 'nada';
}

async function definirPapel(request: APIRequestContext, nivel: string) {
  const adm = await token(request, USUARIOS.adm);
  const r = await request.put('/api/permissoes/papel', {
    headers: { Authorization: `Bearer ${adm}` },
    data: { papel: PAPEL, menu: MENU, nivel },
  });
  expect(r.ok(), `PUT /permissoes/papel (${nivel}) deveria ter sido aceito`).toBeTruthy();
}

test.describe('Permissões — a matriz manda no menu e na API', { tag: '@p0' }, () => {
  test('CT-110 — fechar o menu para o PAPEL tira o item da tela e fecha a API', async ({
    page,
    request,
  }) => {
    expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe('consulta');

    try {
      await definirPapel(request, 'nada');

      // 1) o mapa que alimenta o menu/guards do Angular já não traz o menu
      expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe('nada');

      // 2) a API por baixo da tela recusa — o gate não é só cosmético
      const t = await token(request, USUARIOS.levantador);
      const api = await request.get('/api/rns?ini=2026-01-01&fim=2026-01-31', {
        headers: { Authorization: `Bearer ${t}` },
      });
      expect(api.status(), 'sem o menu, a rota da RNS tem de responder 403').toBe(403);

      // 3) e a tela não oferece mais o caminho
      await entrarComSucesso(page, USUARIOS.levantador);
      await page.goto('/home', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('nav, aside').first()).not.toContainText(
        'Consulta de assuntos (SICLA)',
      );
    } finally {
      await definirPapel(request, 'consulta');
    }
    expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe('consulta');
  });

  test('CT-111 — a exceção por USUÁRIO vence o papel, e "herdar" a desfaz', async ({
    request,
  }) => {
    const adm = await token(request, USUARIOS.adm);
    const cab = { Authorization: `Bearer ${adm}` };
    const lista = desembrulhar(await (await request.get('/api/usuarios', { headers: cab })).json());
    const alvo = (lista.itens as any[]).find((u) => u.login === USUARIOS.levantador);
    expect(alvo, 'o usuário levantador precisa existir (semear-usuarios.mjs)').toBeTruthy();

    const salvarUsuario = async (nivel: string) => {
      const r = await request.put('/api/permissoes/usuario', {
        headers: cab,
        data: { usuarioId: alvo.id, menu: MENU, nivel },
      });
      expect(r.ok(), `PUT /permissoes/usuario (${nivel}) deveria ter sido aceito`).toBeTruthy();
    };

    try {
      // O papel dá `consulta`; a exceção individual fecha só para esta pessoa.
      await salvarUsuario('nada');
      expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe('nada');

      // ...e não respinga em outro usuário do MESMO papel.
      expect(await nivelDoMenu(request, 'lucia.levantadora', MENU)).toBe('consulta');

      // 'herdar' remove a exceção e devolve o nível do papel.
      await salvarUsuario('herdar');
      expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe('consulta');
    } finally {
      await request.put('/api/permissoes/usuario', {
        headers: cab,
        data: { usuarioId: alvo.id, menu: MENU, nivel: 'herdar' },
      });
    }
  });

  test('CT-112 — só quem tem o menu `permissoes` administra a matriz', async ({ request }) => {
    for (const login of [
      USUARIOS.coordenador,
      USUARIOS.gci,
      USUARIOS.consultor,
      USUARIOS.comercial,
    ]) {
      const t = await token(request, login);
      const cab = { Authorization: `Bearer ${t}` };

      const ler = await request.get('/api/permissoes', { headers: cab });
      expect(ler.status(), `${login} não pode LER a matriz completa`).toBe(403);

      const escrever = await request.put('/api/permissoes/papel', {
        headers: cab,
        data: { papel: PAPEL, menu: MENU, nivel: 'alteracao' },
      });
      expect(escrever.status(), `${login} não pode ESCREVER na matriz`).toBe(403);
    }

    // ...e o ADM continua administrando (senão o teste acima passaria com a rota quebrada).
    const adm = await token(request, USUARIOS.adm);
    const ok = await request.get('/api/permissoes', {
      headers: { Authorization: `Bearer ${adm}` },
    });
    expect(ok.ok(), 'o ADM tem de conseguir ler a matriz').toBeTruthy();
  });

  test('CT-113 — a matriz recusa papel e nível inventados', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const cab = { Authorization: `Bearer ${adm}` };

    const papelFalso = await request.put('/api/permissoes/papel', {
      headers: cab,
      data: { papel: 'Diretor', menu: MENU, nivel: 'alteracao' },
    });
    expect(papelFalso.status(), 'papel fora de PERFIS é 400').toBe(400);

    const nivelFalso = await request.put('/api/permissoes/papel', {
      headers: cab,
      data: { papel: PAPEL, menu: MENU, nivel: 'total' },
    });
    expect(nivelFalso.status(), 'nível fora de NIVEIS é 400').toBe(400);

    // O menu inventado não pode virar linha órfã em `permissoes_menu`.
    const antes = await nivelDoMenu(request, USUARIOS.levantador, MENU);
    await request.put('/api/permissoes/papel', {
      headers: cab,
      data: { papel: PAPEL, menu: 'menu_que_nao_existe', nivel: 'alteracao' },
    });
    const matriz = desembrulhar(await (await request.get('/api/permissoes', { headers: cab })).json());
    expect(
      (matriz.menus as any[]).map((m) => m.chave),
      'o catálogo de menus não pode ganhar uma chave inventada',
    ).not.toContain('menu_que_nao_existe');
    expect(await nivelDoMenu(request, USUARIOS.levantador, MENU)).toBe(antes);
  });

  test('CT-114 — as telas de Sistema continuam fixas no Administrador', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const cab = { Authorization: `Bearer ${adm}` };
    const matriz = desembrulhar(await (await request.get('/api/permissoes', { headers: cab })).json());
    const fixas = (matriz.menus as any[]).filter((m) => m.fixaAdm).map((m) => m.chave);

    expect(fixas, 'o painel de Permissões é fixo em ADM — ninguém se tranca fora').toContain(
      'permissoes',
    );
    expect(fixas).toContain('usuarios');

    // Liberar uma tela fixa para outro papel não pode dar acesso a ela.
    try {
      await request.put('/api/permissoes/papel', {
        headers: cab,
        data: { papel: 'Consultor', menu: 'usuarios', nivel: 'alteracao' },
      });
      const t = await token(request, USUARIOS.consultor);
      const r = await request.get('/api/usuarios', { headers: { Authorization: `Bearer ${t}` } });
      expect(
        r.status(),
        'Usuários é uma tela de Sistema: a API é fechada por PERFIS_SISTEMA (só ADM), ' +
          'e liberar a chave na matriz não pode contornar isso',
      ).toBe(403);
    } finally {
      await request.put('/api/permissoes/papel', {
        headers: cab,
        data: { papel: 'Consultor', menu: 'usuarios', nivel: 'nada' },
      });
    }
  });
});
