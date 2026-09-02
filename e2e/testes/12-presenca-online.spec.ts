import { test, expect, APIRequestContext } from '@playwright/test';
import { USUARIOS, entrarComSucesso, token } from '../apoio/painel';

/**
 * Controle de acessos — quem está no Painel agora, e em que tela (Sistema → Usuários →
 * Online). Entrou em 2026-09-01.
 *
 * Duas coisas moram no mesmo controller com gates DIFERENTES, e é justamente aí que um
 * engano não daria erro: **qualquer autenticado bate o ponto** (`/presenca/ping`), mas **só
 * o Administrador vê a lista**. Se a listagem escorregasse para o `RolesGuard` sem
 * `@Roles('ADM')`, todo mundo passaria a ver o IP, o navegador e a tela aberta de todos os
 * colegas — e nada quebraria.
 *
 * A unidade de presença é a **ABA**, não a pessoa: duas abas do mesmo usuário são duas
 * sessões e um usuário só. Sem histórico, por decisão.
 */

const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

/** Sufixo único por execução — cada caso cria as próprias abas e as encerra no fim. */
const marca = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function bater(
  request: APIRequestContext,
  login: string,
  sessao: string,
  dados: { rota: string; titulo: string; visivel?: boolean },
) {
  const t = await token(request, login);
  return request.post('/api/presenca/ping', {
    headers: { Authorization: `Bearer ${t}` },
    data: { sessao, ...dados },
  });
}

async function sair(request: APIRequestContext, login: string, sessao: string) {
  const t = await token(request, login);
  return request.post('/api/presenca/sair', {
    headers: { Authorization: `Bearer ${t}` },
    data: { sessao },
  });
}

async function panorama(request: APIRequestContext) {
  const adm = await token(request, USUARIOS.adm);
  const r = await request.get('/api/presenca', {
    headers: { Authorization: `Bearer ${adm}` },
  });
  expect(r.ok(), 'o ADM tem de conseguir ler o panorama').toBeTruthy();
  return desembrulhar(await r.json());
}

test.describe('Presença — quem está online', { tag: '@p0' }, () => {
  test('CT-121 — a batida aparece no panorama do ADM com a tela em que a pessoa está', async ({
    request,
  }) => {
    const sessao = marca();
    try {
      const ping = await bater(request, USUARIOS.consultor, sessao, {
        rota: '/projetos',
        titulo: 'Projetos',
      });
      expect(ping.status(), 'a batida responde 204 (sem corpo)').toBe(204);

      const p = await panorama(request);
      const eu = (p.usuarios as any[]).find((u) =>
        u.sessoes.some((s: any) => s.sessao === sessao),
      );
      expect(eu, 'quem acabou de bater tem de estar no panorama').toBeTruthy();
      expect(eu.perfil).toBe('Consultor');
      expect(eu.telaAtual, 'o panorama diz em que tela a pessoa está').toBe('Projetos');
      expect(eu.rotaAtual).toBe('/projetos');
      expect(eu.ocioso, 'batida recém-feita e aba visível não é ocioso').toBe(false);
    } finally {
      await sair(request, USUARIOS.consultor, sessao);
    }
  });

  test('CT-122 — a unidade é a ABA: duas abas, duas sessões, um usuário só', async ({
    request,
  }) => {
    const abaA = marca();
    const abaB = marca();
    try {
      await bater(request, USUARIOS.gci, abaA, { rota: '/home', titulo: 'Visão Geral' });
      await bater(request, USUARIOS.gci, abaB, { rota: '/agenda', titulo: 'Agenda' });

      const p = await panorama(request);
      const doGci = (p.usuarios as any[]).filter((u) =>
        u.sessoes.some((s: any) => s.sessao === abaA || s.sessao === abaB),
      );
      expect(doGci.length, 'as duas abas colapsam em UMA pessoa').toBe(1);
      const sessoes = doGci[0].sessoes.map((s: any) => s.sessao);
      expect(sessoes).toContain(abaA);
      expect(sessoes).toContain(abaB);

      // Encerrar uma aba não derruba a outra.
      await sair(request, USUARIOS.gci, abaA);
      const depois = await panorama(request);
      const ainda = (depois.usuarios as any[]).flatMap((u) =>
        u.sessoes.map((s: any) => s.sessao),
      );
      expect(ainda, 'a aba encerrada sai').not.toContain(abaA);
      expect(ainda, 'a que ficou aberta continua').toContain(abaB);
    } finally {
      await sair(request, USUARIOS.gci, abaA);
      await sair(request, USUARIOS.gci, abaB);
    }
  });

  test('CT-123 — a aba com a janela em segundo plano é marcada como ociosa', async ({
    request,
  }) => {
    const sessao = marca();
    try {
      await bater(request, USUARIOS.coordenador, sessao, {
        rota: '/coordenacao',
        titulo: 'Coordenação',
        visivel: false,
      });
      const p = await panorama(request);
      const eu = (p.usuarios as any[]).find((u) =>
        u.sessoes.some((s: any) => s.sessao === sessao),
      );
      expect(eu.ocioso, 'aba em segundo plano conta como ociosa').toBe(true);
      expect(
        eu.sessoes.find((s: any) => s.sessao === sessao).visivel,
        'a sessão registra a visibilidade que o navegador informou',
      ).toBe(false);
    } finally {
      await sair(request, USUARIOS.coordenador, sessao);
    }
  });

  test('CT-124 — todos batem o ponto, mas só o ADM vê a lista', async ({ request }) => {
    const sessoes: [string, string][] = [];
    try {
      for (const login of [
        USUARIOS.coordenador,
        USUARIOS.gci,
        USUARIOS.consultor,
        USUARIOS.administrativo,
        USUARIOS.comercial,
        USUARIOS.levantador,
      ]) {
        const s = marca();
        sessoes.push([login, s]);

        // 1) bater o ponto é de todos — senão ninguém apareceria no controle de acessos
        const ping = await bater(request, login, s, { rota: '/home', titulo: 'Visão Geral' });
        expect(ping.status(), `${login} tem de conseguir bater o ponto`).toBe(204);

        // 2) ver quem está online é só do ADM
        const t = await token(request, login);
        const cab = { Authorization: `Bearer ${t}` };
        expect(
          (await request.get('/api/presenca', { headers: cab })).status(),
          `${login} não pode ver quem está online`,
        ).toBe(403);
        expect(
          (await request.get('/api/presenca/quantos', { headers: cab })).status(),
          `${login} não pode nem contar quem está online`,
        ).toBe(403);
      }

      // ...e o número que o ADM vê inclui todos os que bateram.
      const adm = await token(request, USUARIOS.adm);
      const quantos = desembrulhar(
        await (
          await request.get('/api/presenca/quantos', {
            headers: { Authorization: `Bearer ${adm}` },
          })
        ).json(),
      );
      expect(quantos.online).toBeGreaterThanOrEqual(sessoes.length);
    } finally {
      for (const [login, s] of sessoes) await sair(request, login, s);
    }
  });

  test('CT-125 — a tela /usuarios/online abre para o ADM e não para os demais', async ({
    page,
    request,
  }) => {
    const sessao = marca();
    await bater(request, USUARIOS.consultor, sessao, {
      rota: '/projetos',
      titulo: 'Projetos',
    });
    try {
      await entrarComSucesso(page, USUARIOS.adm);
      await page.goto('/usuarios/online', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/usuarios\/online/);
      await expect(page.locator('body')).toContainText('Consultor Teste', { timeout: 15_000 });

      // Quem não é ADM não entra nem digitando a URL — o guard de perfil desvia.
      await page.context().clearCookies();
      await entrarComSucesso(page, USUARIOS.coordenador);
      await page.goto('/usuarios/online', { waitUntil: 'domcontentloaded' });
      await expect(page, 'quem não é ADM não pode parar em /usuarios/online').not.toHaveURL(
        /\/usuarios\/online/,
      );
    } finally {
      await sair(request, USUARIOS.consultor, sessao);
    }
  });

  test('CT-126 — a batida recusa dado fora do contrato', async ({ request }) => {
    const t = await token(request, USUARIOS.consultor);
    const cab = { Authorization: `Bearer ${t}` };

    const semSessao = await request.post('/api/presenca/ping', {
      headers: cab,
      data: { rota: '/home', titulo: 'Visão Geral' },
    });
    expect(semSessao.status(), 'sem identificar a aba não há o que registrar').toBe(400);

    const rotaGigante = await request.post('/api/presenca/ping', {
      headers: cab,
      data: { sessao: marca(), rota: 'x'.repeat(400), titulo: 'Visão Geral' },
    });
    expect(rotaGigante.status(), 'rota acima de 300 caracteres é recusada').toBe(400);
  });
});
