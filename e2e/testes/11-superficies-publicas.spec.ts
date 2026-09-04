import { test, expect } from '@playwright/test';
import { SENHA, USUARIOS, token } from '../apoio/painel';

/**
 * As 10 rotas que um ANÔNIMO alcança (Seção 5 do inventário de superfícies).
 *
 * É a lista mais sensível do sistema: tudo o mais está atrás do `JwtAuthGuard`, e o que
 * sobra aqui é a porta da rua. Dois riscos moram nela e são o que estes casos cobrem —
 * **enumeração de contas** (descobrir quem tem acesso ao Painel perguntando à API) e
 * **rota nova nascer sem guarda**. O caso CT-120 é o que impede o segundo: ele varre os
 * controllers e compara com a lista escrita aqui.
 */

/** O que HOJE responde sem `Authorization`, com a razão de cada uma. Mudar esta lista é
 * decisão de segurança, não conserto de teste. */
const PUBLICAS: { metodo: string; rota: string; porque: string }[] = [
  { metodo: 'POST', rota: '/api/auth/login', porque: 'porta de entrada' },
  { metodo: 'POST', rota: '/api/auth/refresh', porque: 'rotação do refresh token' },
  { metodo: 'POST', rota: '/api/auth/esqueci-senha', porque: 'quem esqueceu a senha não tem sessão' },
  { metodo: 'POST', rota: '/api/auth/redefinir-senha', porque: 'idem' },
  { metodo: 'POST', rota: '/api/cadastro', porque: 'auto-cadastro (sem porta no login desde 2026-07-30)' },
  { metodo: 'POST', rota: '/api/cadastro/confirmar', porque: 'confirmação por e-mail' },
  { metodo: 'POST', rota: '/api/cadastro/reenviar', porque: 'reenvio do código' },
  { metodo: 'GET', rota: '/api/health', porque: 'sonda de saúde/guardião' },
  { metodo: 'GET', rota: '/api/instancia', porque: 'decide o menu antes de haver login' },
  { metodo: 'GET', rota: '/api/protocolos/:id/video', porque: 'mídia por token assinado na URL' },
];

const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

test.describe('Superfícies públicas — a porta da rua', { tag: '@p0' }, () => {
  test('CT-115 — "esqueci minha senha" responde igual para conta existente e inventada', async ({
    request,
  }) => {
    // Este endpoint não tem login. Se a resposta variasse, ele viraria um verificador de
    // quem tem acesso ao Painel — basta um laço sobre uma lista de e-mails.
    const existente = await request.post('/api/auth/esqueci-senha', {
      data: { email: 'adm@rech.com.br' },
    });
    const inventado = await request.post('/api/auth/esqueci-senha', {
      data: { email: 'nao-existe-neste-painel@exemplo.invalido' },
    });

    expect(existente.status(), 'conta existente').toBe(200);
    expect(inventado.status(), 'conta inventada — MESMO status').toBe(200);

    const a = await existente.json();
    const b = await inventado.json();
    expect(
      b.message ?? b.mensagem,
      'a mensagem não pode denunciar se o e-mail está cadastrado',
    ).toBe(a.message ?? a.mensagem);
  });

  test('CT-116 — redefinir com código errado não troca a senha e dá resposta genérica', async ({
    request,
  }) => {
    const semPedido = await request.post('/api/auth/redefinir-senha', {
      data: {
        email: 'adm@rech.com.br',
        codigo: '000000',
        senhaNova: 'Invadida@123',
      },
    });
    const contaInventada = await request.post('/api/auth/redefinir-senha', {
      data: {
        email: 'nao-existe-neste-painel@exemplo.invalido',
        codigo: '000000',
        senhaNova: 'Invadida@123',
      },
    });

    expect(semPedido.status()).toBe(400);
    expect(contaInventada.status()).toBe(400);
    const m1 = (await semPedido.json()).message;
    const m2 = (await contaInventada.json()).message;
    expect(
      JSON.stringify(m2),
      '"não há pedido" e "conta não existe" têm de contar a MESMA história',
    ).toBe(JSON.stringify(m1));

    // E o que importa de verdade: a senha do ADM continua sendo a de antes.
    const entrar = await request.post('/api/auth/login', {
      data: { login: USUARIOS.adm, senha: SENHA },
    });
    expect(entrar.ok(), 'a senha original tem de continuar valendo').toBeTruthy();
    const invadido = await request.post('/api/auth/login', {
      data: { login: USUARIOS.adm, senha: 'Invadida@123' },
    });
    expect(invadido.status(), 'a senha tentada NÃO pode ter sido gravada').toBe(401);
  });

  test('CT-117 — /health e /instancia respondem sem sessão, e sem contar demais', async ({
    request,
  }) => {
    const saude = desembrulhar(await (await request.get('/api/health')).json());
    expect(saude.db, 'a suíte só roda contra instância descartável').toBe('better-sqlite3');

    const inst = desembrulhar(await (await request.get('/api/instancia')).json());
    expect(inst.perfil, 'esta é a instância PAINEL (a 5198 é o portal-api)').toBe('painel');

    // Sondas públicas não podem virar vazamento de configuração.
    const bruto = JSON.stringify({ saude, inst }).toLowerCase();
    for (const proibido of ['senha', 'password', 'secret', 'token', 'pfx', 'jwt']) {
      expect(bruto, `sonda pública não pode conter "${proibido}"`).not.toContain(proibido);
    }
  });

  test('CT-118 — a mídia de protocolo exige o token assinado, não a sessão', async ({
    request,
  }) => {
    // Sem token na URL não se baixa nada — e um token inventado também não.
    const semToken = await request.get('/api/protocolos/1/video');
    expect([400, 401, 403, 404], 'sem token assinado não se serve mídia').toContain(
      semToken.status(),
    );

    const tokenInventado = await request.get('/api/protocolos/1/video?token=nao-vale-nada');
    expect([400, 401, 403, 404]).toContain(tokenInventado.status());

    // Nem mesmo um JWT de ADM no cabeçalho abre esta rota: ela é assinada na URL de propósito
    // (URL entra em log de servidor, então o token de sessão nunca vai para lá).
    const adm = await token(request, USUARIOS.adm);
    const comJwt = await request.get('/api/protocolos/1/video', {
      headers: { Authorization: `Bearer ${adm}` },
    });
    expect([400, 401, 403, 404]).toContain(comJwt.status());
  });

  test('CT-119 — rota autenticada sem credencial é 401, nunca 200 com dado', async ({
    request,
  }) => {
    // Amostra deliberadamente espalhada: uma de cada área sensível do Painel.
    const alvos = [
      '/api/projetos',
      '/api/usuarios',
      '/api/permissoes',
      '/api/presenca',
      '/api/atividades/quadros',
      '/api/painel/home',
      '/api/dados/v1/consultas',
    ];
    for (const rota of alvos) {
      const r = await request.get(rota);
      expect(r.status(), `${rota} sem credencial`).toBe(401);
    }
  });

  test('CT-120 — nenhuma rota NOVA nasceu sem guarda de autenticação', async ({ request }) => {
    // Guarda de perpetuidade (Fase 8): o Swagger da instância lista TODAS as rotas servidas.
    // Qualquer uma que responda sem `Authorization` e não esteja em PUBLICAS é achado.
    const doc = await request.get('/api/docs-json');
    test.skip(!doc.ok(), 'esta instância não expõe /api/docs-json — caso não aplicável aqui');

    const spec = await doc.json();
    const servidas: { metodo: string; rota: string }[] = [];
    for (const [caminho, verbos] of Object.entries<any>(spec.paths ?? {})) {
      for (const verbo of Object.keys(verbos)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(verbo)) continue;
        servidas.push({ metodo: verbo.toUpperCase(), rota: caminho });
      }
    }
    expect(servidas.length, 'o Swagger tem de listar as rotas').toBeGreaterThan(100);

    const normalizar = (r: string) => r.replace(/\{[^}]+\}/g, ':id').replace(/\/+$/, '');
    const declaradas = new Set(PUBLICAS.map((p) => `${p.metodo} ${normalizar(p.rota)}`));

    // Só GET: um POST às cegas em rota desconhecida escreveria no banco.
    const suspeitas: string[] = [];
    for (const { metodo, rota } of servidas) {
      if (metodo !== 'GET') continue;
      const chave = `GET ${normalizar(rota)}`;
      if (declaradas.has(chave)) continue;
      const alvo = normalizar(rota).replace(/:id/g, '1');
      const r = await request.get(alvo);
      if (r.status() !== 401 && r.status() !== 403) suspeitas.push(`${chave} → ${r.status()}`);
    }

    expect(
      suspeitas,
      'GET público não declarado em PUBLICAS. Se for intencional, acrescente à lista ' +
        'com a razão E à Seção 5 do inventário; se não, a rota nasceu sem guarda.',
    ).toEqual([]);
  });
});
