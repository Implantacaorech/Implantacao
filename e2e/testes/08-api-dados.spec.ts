import { test, expect, APIRequestContext } from '@playwright/test';
import { token, USUARIOS } from '../apoio/painel';
import { PORTAL_API, SEM_PORTAL_API, portalApiNoAr } from '../apoio/portal-api';

/**
 * **API de Dados** (ADR-0003) — a fronteira única entre o Painel e os bancos EXTERNOS.
 *
 * A regra: *toda e qualquer consulta a banco de dados externo passa por uma API*. Uma
 * fronteira só vale o que ela recusa — então o que estes testes atacam é o contorno:
 *
 * - entrar sem credencial, ou com chave inválida/revogada;
 * - pedir uma consulta cujo menu a pessoa não enxerga (a API não pode ser porta lateral em
 *   volta do painel de Permissões);
 * - pedir uma consulta que o token NÃO autoriza (a autorização é por consulta, não por
 *   conexão: um token do painel de RNS não serve para o extrato de horas);
 * - administrar a API sem ser ADM — inclusive **com uma chave de máquina**, que é o caminho
 *   pelo qual uma credencial vazada tentaria emitir outra;
 * - mandar SQL/limite/conexão no corpo, que é como a regra viraria fachada.
 *
 * Rodam contra a instância isolada da 5199, onde nenhuma conexão externa está cadastrada —
 * por isso a execução legítima termina em `503`. Isso é o esperado e prova o caminho feliz
 * até a última fronteira: catálogo → validação → permissão → conexão.
 */

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const chaveCab = (k: string) => ({ 'X-API-Key': k });
const dados = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

// A API de Dados é servida pelo **Portal API** — desde 2026-08-26 a administração existe só
// lá. As rotas do lado CONSUMIDOR (`/tokens`) continuam sendo do Painel, e por isso usam
// caminho relativo, que o `baseURL` do Playwright resolve na 5199.
const BASE = `${PORTAL_API}/api/dados/v1`;
const ADMIN = `${BASE}/admin`;
const TOKENS_DO_PAINEL = '/api/dados/v1/tokens';
const CONSULTA = 'sicla.rns.listar';
const PARAMS_OK = { data_ini: '2026-08-01', data_fim: '2026-08-31' };
/** Formato que o Portal API emite: `rd_<12 hex>_<48 hex>`. Não é uma chave válida — serve
 * para exercitar o que vem DEPOIS da checagem de formato. */
const TOKEN_FORMATO_OK = `rd_${'a'.repeat(12)}_${'b'.repeat(48)}`;

/** JWT **no Portal API** — é outra instância, com outro login a fazer. */
async function tokenPortalApi(
  request: APIRequestContext,
  login: string,
): Promise<string> {
  const r = await request.post(`${PORTAL_API}/api/auth/login`, {
    data: { login, senha: 'Teste@123' },
    failOnStatusCode: false,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return dados(await r.json()).accessToken;
}

const admPortalApi = (request: APIRequestContext) =>
  tokenPortalApi(request, USUARIOS.adm);

/** Cria um cliente de máquina e devolve a chave em claro (a única exibição). */
async function criarCliente(
  request: APIRequestContext,
  nome: string,
  consultas: string[],
): Promise<{ id: number; chave: string }> {
  const adm = await admPortalApi(request);
  const r = await request.post(`${ADMIN}/clientes`, {
    headers: cab(adm),
    data: { nome, consultas, observacao: 'e2e' },
  });
  expect(r.status(), await r.text()).toBe(201);
  const c = dados(await r.json());
  return { id: c.id, chave: c.chave };
}

test.describe('API de Dados — a fronteira recusa quem deve recusar', () => {
  // A administração da API existe só no Portal API. Sem ele no ar, PULA — um vermelho
  // permanente treina o time a ignorar o CI (ver apoio/portal-api.ts).
  test.beforeEach(async ({ request }) => {
    test.skip(!(await portalApiNoAr(request)), SEM_PORTAL_API);
  });

  test('sem credencial nenhuma: 401 no catálogo e na execução', async ({ request }) => {
    const cat = await request.get(`${BASE}/consultas`, { failOnStatusCode: false });
    expect(cat.status()).toBe(401);

    const exec = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(exec.status()).toBe(401);
  });

  test('o catálogo NUNCA devolve o SQL', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.get(`${BASE}/consultas`, { headers: cab(adm) });
    expect(r.status()).toBe(200);

    const bruto = await r.text();
    // O SQL revela como a consulta é feita e muda sem aviso — não é contrato. A checagem
    // mira o SHAPE de um COMANDO, não palavras soltas: a descrição é texto humano e cita de
    // propósito a view de origem ("SICLA.LISTA_ITEMPED"), que é documentação útil para quem
    // consome — nomear a fonte não é vazar a consulta.
    expect(bruto).not.toMatch(/\bSELECT\b[\s\S]*\bFROM\b/i);

    const cat = dados(JSON.parse(bruto));
    expect(cat.versao).toBe('v1');
    expect(cat.consultas.length).toBeGreaterThan(10);
    expect(cat.consultas.every((c: any) => !('origem' in c) && !('sql' in c))).toBe(true);
  });

  test('consulta fora do catálogo: 404, não 500', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${BASE}/consultas/nao.existe.aqui/executar`, {
      headers: cab(adm),
      data: { parametros: {} },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(404);
  });

  test('parâmetro inválido: 400 — e o banco nem é procurado', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: { parametros: { data_ini: 'ontem', data_fim: '2026-08-31' } },
      failOnStatusCode: false,
    });
    // 400 (requisição), NÃO 503 (conexão) — a validação vem antes de tocar na conexão.
    expect(r.status()).toBe(400);
  });

  test('parâmetro que não existe no contrato é recusado', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: { parametros: { ...PARAMS_OK, jeitinho: '1' } },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  test('SQL, conexão e limite no corpo são ignorados — não há atalho', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: {
        parametros: PARAMS_OK,
        sql: 'SELECT * FROM SICLA.CLIENTES',
        conexao: 'portal_rech',
        limite: 999999,
      },
      failOnStatusCode: false,
    });
    // O ValidationPipe global usa forbidNonWhitelisted/whitelist: campo estranho no DTO é
    // recusado. O que NÃO pode acontecer em hipótese alguma é o SQL do corpo ser executado.
    expect([400, 503]).toContain(r.status());
    expect(await r.text()).not.toContain('SICLA.CLIENTES');
  });

  test('requisição legítima chega até a conexão e para em 503 (nada cadastrado aqui)', async ({
    request,
  }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(503);
    // 503 diz ONDE se resolve; não é um erro genérico.
    expect((await r.text()).toLowerCase()).toContain('sicla');
  });

  test('quem não enxerga a tela não consulta o dado por baixo dela', async ({ request }) => {
    // O Comercial não tem o menu `rns`. Se a API respondesse aqui, ela seria uma porta
    // lateral em volta do painel de Permissões.
    const comercial = await tokenPortalApi(request, USUARIOS.comercial);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(comercial),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(403);
  });
});

test.describe('API de Dados — clientes de máquina', () => {
  // A administração da API existe só no Portal API. Sem ele no ar, PULA — um vermelho
  // permanente treina o time a ignorar o CI (ver apoio/portal-api.ts).
  test.beforeEach(async ({ request }) => {
    test.skip(!(await portalApiNoAr(request)), SEM_PORTAL_API);
  });

  test('só ADM administra: os demais perfis levam 403', async ({ request }) => {
    for (const login of [USUARIOS.coordenador, USUARIOS.consultor, USUARIOS.comercial]) {
      const tk = await tokenPortalApi(request, login);
      const r = await request.get(`${ADMIN}/clientes`, {
        headers: cab(tk),
        failOnStatusCode: false,
      });
      expect(r.status(), `perfil ${login} não pode listar clientes`).toBe(403);
    }
  });

  test('uma chave de máquina NÃO administra a API (não emite outra chave)', async ({
    request,
  }) => {
    const { chave } = await criarCliente(request, 'e2e escalonamento', [CONSULTA]);

    // A rota /admin exige pessoa (JwtAuthGuard): a chave não é aceita como credencial ali.
    const lista = await request.get(`${ADMIN}/clientes`, {
      headers: chaveCab(chave),
      failOnStatusCode: false,
    });
    expect(lista.status()).toBe(401);

    const nova = await request.post(`${ADMIN}/clientes`, {
      headers: chaveCab(chave),
      data: { nome: 'forjado', consultas: [CONSULTA] },
      failOnStatusCode: false,
    });
    expect(nova.status()).toBe(401);
  });

  test('a chave é exibida uma vez e nunca volta na listagem', async ({ request }) => {
    const { chave } = await criarCliente(request, 'e2e chave única', [CONSULTA]);
    expect(chave).toMatch(/^rd_[0-9a-f]+_[0-9a-f]+$/);

    const adm = await admPortalApi(request);
    const bruto = await (await request.get(`${ADMIN}/clientes`, { headers: cab(adm) })).text();
    expect(bruto).not.toContain(chave);
    expect(bruto).not.toContain('chaveHash');
  });

  test('chave válida entra; chave inventada, alterada ou revogada não', async ({ request }) => {
    const { id, chave } = await criarCliente(request, 'e2e ciclo de vida', [CONSULTA]);

    const ok = await request.get(`${BASE}/consultas`, { headers: chaveCab(chave) });
    expect(ok.status()).toBe(200);

    for (const ruim of ['lixo', `${chave}x`, 'rd_naoexiste_abcdef']) {
      const r = await request.get(`${BASE}/consultas`, {
        headers: chaveCab(ruim),
        failOnStatusCode: false,
      });
      expect(r.status(), `chave "${ruim.slice(0, 12)}…" não pode entrar`).toBe(401);
    }

    const adm = await admPortalApi(request);
    await request.patch(`${ADMIN}/clientes/${id}/ativo`, {
      headers: cab(adm),
      data: { ativo: false },
    });

    const revogada = await request.get(`${BASE}/consultas`, {
      headers: chaveCab(chave),
      failOnStatusCode: false,
    });
    expect(revogada.status(), 'revogar corta o acesso na hora').toBe(401);
  });

  test('rotacionar mata a chave anterior imediatamente', async ({ request }) => {
    const { id, chave: antiga } = await criarCliente(request, 'e2e rotação', [CONSULTA]);
    const adm = await admPortalApi(request);

    const r = await request.post(`${ADMIN}/clientes/${id}/rotacionar`, { headers: cab(adm) });
    const nova = dados(await r.json()).chave as string;
    expect(nova).not.toBe(antiga);

    const velha = await request.get(`${BASE}/consultas`, {
      headers: chaveCab(antiga),
      failOnStatusCode: false,
    });
    expect(velha.status()).toBe(401);

    const atual = await request.get(`${BASE}/consultas`, { headers: chaveCab(nova) });
    expect(atual.status()).toBe(200);
  });

  test('o token é um teto POR CONSULTA: fora da lista, 403 — e o catálogo vem recortado', async ({
    request,
  }) => {
    // Autoriza UMA consulta só. É a diferença que o desenho das duas instâncias exige: um
    // token destinado a um painel não pode arrastar a conexão inteira junto.
    const { chave } = await criarCliente(request, 'e2e só visitas', [
      'portal.visitas.listar',
    ]);

    const cat = dados(
      await (
        await request.get(`${BASE}/consultas`, { headers: chaveCab(chave) })
      ).json(),
    );
    expect(cat.consultas.map((c: any) => c.nome)).toEqual([
      'portal.visitas.listar',
    ]);

    const fora = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: chaveCab(chave),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(fora.status()).toBe(403);
  });

  test('uma consulta da MESMA conexão, não autorizada, também dá 403', async ({
    request,
  }) => {
    // O caso que a autorização por conexão deixava passar: mesmo banco, consulta diferente.
    const { chave } = await criarCliente(request, 'e2e só rns', ['sicla.rns.listar']);

    const permitida = await request.post(`${BASE}/consultas/sicla.rns.listar/executar`, {
      headers: chaveCab(chave),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(permitida.status(), 'a autorizada chega até a conexão').toBe(503);

    const vizinha = await request.post(
      `${BASE}/consultas/sicla.bi.extrato-horas/executar`,
      { headers: chaveCab(chave), data: { parametros: {} }, failOnStatusCode: false },
    );
    expect(vizinha.status()).toBe(403);
  });

  test('consulta inexistente não é cadastrável num token', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${ADMIN}/clientes`, {
      headers: cab(adm),
      data: { nome: 'e2e consulta inventada', consultas: ['nao.existe.aqui'] },
      failOnStatusCode: false,
    });
    // Autorizar uma consulta que não existe criaria um token que autentica e nunca consegue
    // chamar nada — 403 sem explicação, do outro lado.
    expect(r.status()).toBe(400);
  });
});

/** Consulta criada pela TELA (fase 3). A autonomia de publicar sem release só é aceitável
 * porque a publicação valida o contrato inteiro na hora de salvar — é isso que se ataca aqui.
 * Nenhum destes casos precisa de banco externo: a recusa acontece antes de qualquer conexão. */
test.describe('API de Dados — publicar consulta pela tela', () => {
  // A administração da API existe só no Portal API. Sem ele no ar, PULA — um vermelho
  // permanente treina o time a ignorar o CI (ver apoio/portal-api.ts).
  test.beforeEach(async ({ request }) => {
    test.skip(!(await portalApiNoAr(request)), SEM_PORTAL_API);
  });

  const NOVA = `${ADMIN}/consultas`;

  const consulta = (over: Record<string, unknown> = {}) => ({
    slug: 'e2e_consulta',
    nome: 'Consulta e2e',
    conexao: 'sicla',
    sql: 'SELECT 1 AS UM FROM DUAL',
    nomeApi: 'sicla.e2e.consulta',
    parametros: [],
    colunas: ['UM'],
    limiteLinhas: 100,
    cacheSegundos: 0,
    publicada: false,
    ...over,
  });

  test('só ADM administra consultas — nem usuário comum, nem chave de máquina', async ({
    request,
  }) => {
    const comum = await tokenPortalApi(request, USUARIOS.consultor);
    const r = await request.get(NOVA, { headers: cab(comum), failOnStatusCode: false });
    expect(r.status()).toBe(403);

    // O caminho pelo qual uma chave vazada tentaria criar a própria consulta.
    const { chave } = await criarCliente(request, 'e2e sem admin', [CONSULTA]);
    const comChave = await request.get(NOVA, {
      headers: chaveCab(chave),
      failOnStatusCode: false,
    });
    expect(comChave.status()).toBe(401);
  });

  test('não publica nada que não seja SELECT', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(NOVA, {
      headers: cab(adm),
      data: consulta({ sql: 'DELETE FROM SICLA.LISTA_ITEMPED' }),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain('SELECT');
  });

  test('publicar sem teto de linhas é recusado', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(NOVA, {
      headers: cab(adm),
      data: consulta({ publicada: true, limiteLinhas: 0 }),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  test('bind sem parâmetro declarado é recusado na publicação', async ({ request }) => {
    // Deixar passar geraria uma consulta que autentica, entra no catálogo e sempre falha no
    // banco (ORA-01008) — erro que só aparece para quem consome.
    const adm = await admPortalApi(request);
    const r = await request.post(NOVA, {
      headers: cab(adm),
      data: consulta({
        publicada: true,
        sql: 'SELECT 1 FROM DUAL WHERE X = :cliente',
        parametros: [],
      }),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
    expect(await r.text()).toContain('cliente');
  });

  test('a tela não sequestra um nome do catálogo de código', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(NOVA, {
      headers: cab(adm),
      data: consulta({ publicada: true, nomeApi: CONSULTA }),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  test('rascunho salva, entra na lista e NÃO aparece no catálogo', async ({ request }) => {
    const adm = await admPortalApi(request);
    const salvo = await request.post(NOVA, { headers: cab(adm), data: consulta() });
    expect(salvo.status(), await salvo.text()).toBe(201);

    const lista = dados(await (await request.get(NOVA, { headers: cab(adm) })).json());
    expect(lista.some((c: any) => c.slug === 'e2e_consulta')).toBe(true);

    const catalogo = dados(
      await (await request.get(`${BASE}/consultas`, { headers: cab(adm) })).json(),
    );
    expect(catalogo.consultas.some((c: any) => c.nome === 'sicla.e2e.consulta')).toBe(false);

    await request.delete(`${NOVA}/e2e_consulta`, { headers: cab(adm) });
  });

  test('publicada entra no catálogo e pode ser autorizada num token', async ({ request }) => {
    const adm = await admPortalApi(request);
    const salvo = await request.post(NOVA, {
      headers: cab(adm),
      data: consulta({ slug: 'e2e_publicada', nomeApi: 'sicla.e2e.publicada', publicada: true }),
    });
    expect(salvo.status(), await salvo.text()).toBe(201);

    const catalogo = dados(
      await (await request.get(`${BASE}/consultas`, { headers: cab(adm) })).json(),
    );
    const nova = catalogo.consultas.find((c: any) => c.nome === 'sicla.e2e.publicada');
    expect(nova, 'a publicada aparece no catálogo').toBeTruthy();
    // O SQL continua fora do catálogo, mesmo para uma consulta criada na tela.
    expect(JSON.stringify(nova)).not.toContain('DUAL');

    const { chave } = await criarCliente(request, 'e2e token da tela', [
      'sicla.e2e.publicada',
    ]);
    const exec = await request.post(`${BASE}/consultas/sicla.e2e.publicada/executar`, {
      headers: chaveCab(chave),
      data: { parametros: {} },
      failOnStatusCode: false,
    });
    // 503 = chegou até a conexão (não cadastrada na instância isolada). Prova o caminho
    // inteiro: catálogo de tela → autorização por consulta → executor.
    expect(exec.status(), await exec.text()).toBe(503);

    await request.delete(`${NOVA}/e2e_publicada`, { headers: cab(adm) });
  });
});

/** Conexões e TOKENS — as duas pontas do desenho de duas instâncias.
 *
 * A conexão é o que só o **Portal API** tem; o token é o que só o **Portal Implantação**
 * guarda. O que se ataca aqui é o que não pode escapar de cada ponta: a senha do banco de um
 * lado, o token do outro. */
test.describe('API de Dados — conexões (Portal API)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await portalApiNoAr(request)), SEM_PORTAL_API);
  });

  test('a configuração das conexões NUNCA devolve a senha', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.get(`${ADMIN}/conexoes`, { headers: cab(adm) });
    expect(r.status()).toBe(200);

    const corpo = await r.text();
    const conexoes = dados(JSON.parse(corpo));
    expect(conexoes.length).toBe(2);
    // `temSenha` responde "existe uma?" sem devolvê-la — é o contrato da tela.
    for (const c of conexoes) {
      expect(c).toHaveProperty('temSenha');
      expect(c.campos).not.toHaveProperty('senha');
    }
    expect(corpo).not.toContain('"senha"');
  });

  test('conexão inexistente é 404, não 500', async ({ request }) => {
    const adm = await admPortalApi(request);
    const r = await request.post(`${ADMIN}/conexoes/oracle-do-vizinho`, {
      headers: cab(adm),
      data: { host: 'x' },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(404);
  });

  test('só ADM administra conexão — nem usuário comum, nem chave de máquina', async ({
    request,
  }) => {
    const comum = await tokenPortalApi(request, USUARIOS.consultor);
    const r = await request.get(`${ADMIN}/conexoes`, {
      headers: cab(comum),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(403);

    // O caminho pelo qual uma chave vazada tentaria ler a credencial do banco.
    const { chave } = await criarCliente(request, 'e2e sem conexoes', [CONSULTA]);
    const comChave = await request.get(`${ADMIN}/conexoes`, {
      headers: chaveCab(chave),
      failOnStatusCode: false,
    });
    expect(comChave.status()).toBe(401);
  });

});

/** Lado CONSUMIDOR — roda no PAINEL, e por isso NÃO depende do Portal API estar no ar. */
test.describe('API de Dados — tokens do Painel', () => {
  test('o token do lado consumidor não volta na listagem — só o prefixo', async ({
    request,
  }) => {
    const adm = await token(request, USUARIOS.adm);
    const criado = await request.post(TOKENS_DO_PAINEL, {
      headers: cab(adm),
      data: {
        nome: 'e2e portal api',
        // Endereço inalcançável DE PROPÓSITO: o cadastro não pode depender de a outra
        // instância estar no ar, e nenhuma consulta real usa este nome.
        url: 'http://127.0.0.1:59999',
        chave: 'rd_e2eprefixo01_segredo-que-nao-pode-voltar',
        consultas: ['nao.existe.aqui'],
      },
    });
    expect(criado.status(), await criado.text()).toBe(201);

    const lista = await request.get(TOKENS_DO_PAINEL, { headers: cab(adm) });
    const corpo = await lista.text();
    expect(corpo).not.toContain('segredo-que-nao-pode-voltar');
    expect(corpo).toContain('e2eprefixo01');

    const painel = dados(JSON.parse(corpo));
    expect(painel.consumoRemotoAtivo).toBe(true);
    // "O que ainda não tem token" precisa listar o catálogo inteiro aqui.
    expect(painel.descobertas).toContain(CONSULTA);

    const id = painel.itens.find((t: any) => t.nome === 'e2e portal api').id;
    await request.delete(`${TOKENS_DO_PAINEL}/${id}`, { headers: cab(adm) });
  });

  test('sondar um Portal API inalcançável responde com o endereço, não com stack', async ({
    request,
  }) => {
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${TOKENS_DO_PAINEL}/sondar`, {
      headers: cab(adm),
      // Token BEM FORMADO de propósito: o que se testa aqui é o endereço fora do ar, e um
      // token malformado seria barrado antes de a rede ser tocada (caso seguinte).
      data: { url: 'http://127.0.0.1:59999', chave: TOKEN_FORMATO_OK },
    });
    expect(r.status()).toBe(200);
    const s = dados(await r.json());
    expect(s.ok).toBe(false);
    expect(s.mensagem).toContain('127.0.0.1:59999');
  });

  test('token colado pela METADE é diagnosticado, não chamado de revogado', async ({
    request,
  }) => {
    // Caso real de 2026-08-26: a cópia com o mouse levou meio token, o Portal API devolveu
    // 401 e a mensagem AFIRMAVA "foi revogado ou rotacionado" — mandando procurar no lugar
    // errado. Agora o formato é conferido antes de gastar uma ida à rede.
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${TOKENS_DO_PAINEL}/sondar`, {
      headers: cab(adm),
      data: { url: 'http://127.0.0.1:59999', chave: TOKEN_FORMATO_OK.slice(0, 40) },
    });
    const s = dados(await r.json());
    expect(s.ok).toBe(false);
    expect(s.mensagem).toContain('INCOMPLETO');
    expect(s.mensagem).not.toContain('revogado');
  });

  test('só ADM mexe nos tokens do Painel', async ({ request }) => {
    const comum = await token(request, USUARIOS.consultor);
    const r = await request.get(TOKENS_DO_PAINEL, {
      headers: cab(comum),
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(403);
  });
});
