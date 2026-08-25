import { test, expect, APIRequestContext } from '@playwright/test';
import { token, USUARIOS } from '../apoio/painel';

/**
 * **API de Dados** (ADR-0003) — a fronteira única entre o Painel e os bancos EXTERNOS.
 *
 * A regra: *toda e qualquer consulta a banco de dados externo passa por uma API*. Uma
 * fronteira só vale o que ela recusa — então o que estes testes atacam é o contorno:
 *
 * - entrar sem credencial, ou com chave inválida/revogada;
 * - pedir uma consulta cujo menu a pessoa não enxerga (a API não pode ser porta lateral em
 *   volta do painel de Permissões);
 * - pedir uma consulta fora do escopo cadastrado da chave;
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

const BASE = '/api/dados/v1';
const ADMIN = `${BASE}/admin`;
const CONSULTA = 'sicla.rns.listar';
const PARAMS_OK = { data_ini: '2026-08-01', data_fim: '2026-08-31' };

/** Cria um cliente de máquina e devolve a chave em claro (a única exibição). */
async function criarCliente(
  request: APIRequestContext,
  nome: string,
  escopos: string[],
): Promise<{ id: number; chave: string }> {
  const adm = await token(request, USUARIOS.adm);
  const r = await request.post(`${ADMIN}/clientes`, {
    headers: cab(adm),
    data: { nome, escopos, observacao: 'e2e' },
  });
  expect(r.status(), await r.text()).toBe(201);
  const c = dados(await r.json());
  return { id: c.id, chave: c.chave };
}

test.describe('API de Dados — a fronteira recusa quem deve recusar', () => {
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
    const adm = await token(request, USUARIOS.adm);
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
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${BASE}/consultas/nao.existe.aqui/executar`, {
      headers: cab(adm),
      data: { parametros: {} },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(404);
  });

  test('parâmetro inválido: 400 — e o banco nem é procurado', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: { parametros: { data_ini: 'ontem', data_fim: '2026-08-31' } },
      failOnStatusCode: false,
    });
    // 400 (requisição), NÃO 503 (conexão) — a validação vem antes de tocar na conexão.
    expect(r.status()).toBe(400);
  });

  test('parâmetro que não existe no contrato é recusado', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(adm),
      data: { parametros: { ...PARAMS_OK, jeitinho: '1' } },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(400);
  });

  test('SQL, conexão e limite no corpo são ignorados — não há atalho', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
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
    const adm = await token(request, USUARIOS.adm);
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
    const comercial = await token(request, USUARIOS.comercial);
    const r = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: cab(comercial),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(403);
  });
});

test.describe('API de Dados — clientes de máquina', () => {
  test('só ADM administra: os demais perfis levam 403', async ({ request }) => {
    for (const login of [USUARIOS.coordenador, USUARIOS.consultor, USUARIOS.comercial]) {
      const tk = await token(request, login);
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
    const { chave } = await criarCliente(request, 'e2e escalonamento', ['sicla:leitura']);

    // A rota /admin exige pessoa (JwtAuthGuard): a chave não é aceita como credencial ali.
    const lista = await request.get(`${ADMIN}/clientes`, {
      headers: chaveCab(chave),
      failOnStatusCode: false,
    });
    expect(lista.status()).toBe(401);

    const nova = await request.post(`${ADMIN}/clientes`, {
      headers: chaveCab(chave),
      data: { nome: 'forjado', escopos: ['sicla:leitura'] },
      failOnStatusCode: false,
    });
    expect(nova.status()).toBe(401);
  });

  test('a chave é exibida uma vez e nunca volta na listagem', async ({ request }) => {
    const { chave } = await criarCliente(request, 'e2e chave única', ['sicla:leitura']);
    expect(chave).toMatch(/^rd_[0-9a-f]+_[0-9a-f]+$/);

    const adm = await token(request, USUARIOS.adm);
    const bruto = await (await request.get(`${ADMIN}/clientes`, { headers: cab(adm) })).text();
    expect(bruto).not.toContain(chave);
    expect(bruto).not.toContain('chaveHash');
  });

  test('chave válida entra; chave inventada, alterada ou revogada não', async ({ request }) => {
    const { id, chave } = await criarCliente(request, 'e2e ciclo de vida', ['sicla:leitura']);

    const ok = await request.get(`${BASE}/consultas`, { headers: chaveCab(chave) });
    expect(ok.status()).toBe(200);

    for (const ruim of ['lixo', `${chave}x`, 'rd_naoexiste_abcdef']) {
      const r = await request.get(`${BASE}/consultas`, {
        headers: chaveCab(ruim),
        failOnStatusCode: false,
      });
      expect(r.status(), `chave "${ruim.slice(0, 12)}…" não pode entrar`).toBe(401);
    }

    const adm = await token(request, USUARIOS.adm);
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
    const { id, chave: antiga } = await criarCliente(request, 'e2e rotação', ['sicla:leitura']);
    const adm = await token(request, USUARIOS.adm);

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

  test('o escopo é um teto: fora dele, 403 — e o catálogo já vem recortado', async ({
    request,
  }) => {
    const { chave } = await criarCliente(request, 'e2e só portal', ['portal_rech:leitura']);

    const cat = dados(await (await request.get(`${BASE}/consultas`, {
      headers: chaveCab(chave),
    })).json());
    expect(cat.consultas.length).toBeGreaterThan(0);
    expect(cat.consultas.every((c: any) => c.conexao === 'portal_rech')).toBe(true);

    const fora = await request.post(`${BASE}/consultas/${CONSULTA}/executar`, {
      headers: chaveCab(chave),
      data: { parametros: PARAMS_OK },
      failOnStatusCode: false,
    });
    expect(fora.status()).toBe(403);
  });

  test('escopo inexistente não é cadastrável', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const r = await request.post(`${ADMIN}/clientes`, {
      headers: cab(adm),
      data: { nome: 'e2e escopo inventado', escopos: ['banco_secreto:escrita'] },
      failOnStatusCode: false,
    });
    // Cadastrar um escopo que não existe criaria um cliente que autentica e nunca consegue
    // chamar nada — 403 sem explicação, do outro lado.
    expect(r.status()).toBe(400);
  });
});
