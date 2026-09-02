import { test, expect, APIRequestContext } from '@playwright/test';
import { token, USUARIOS } from '../apoio/painel';

/**
 * CRUD completo, módulo a módulo (Fase 4 da auditoria).
 *
 * Ciclo CREATE → READ (detalhe, lista, paginação, busca) → UPDATE → DELETE, mais os casos de
 * borda que costumam revelar defeito: corpo vazio, campo desconhecido, valor fora do enum,
 * acima do máximo, obrigatório faltando, acentuação, HTML e id inválido.
 *
 * Complementa `04-permissoes-fluxo`: lá o foco é QUEM pode; aqui é se o dado vai e volta
 * inteiro.
 */

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);
const corpo = async (r: any) => desembrulhar(await r.json());

async function criarProjeto(request: APIRequestContext, cliente: string) {
  const tk = await token(request, USUARIOS.coordenador);
  const r = await request.post('/api/projetos', {
    headers: cab(tk),
    data: { cliente, cnpj: '11222333000181', modulos: 'FAT', numeroProjeto: 'P-900' },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return (await corpo(r)).id as number;
}

test.describe('CRUD — Projetos', { tag: '@p1' }, () => {
  test('CT-036 — ciclo completo: cria, lê, lista, busca, edita e exclui', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const coord = await token(request, USUARIOS.coordenador);
    const id = await criarProjeto(request, 'CRUD e2e LTDA');

    const detalhe = await corpo(await request.get(`/api/projetos/${id}`, { headers: cab(adm) }));
    expect(detalhe.cliente).toBe('CRUD e2e LTDA');

    const lista = await (await request.get('/api/projetos?page=1&limit=5', { headers: cab(adm) })).json();
    expect(Array.isArray(lista.data)).toBe(true);
    expect(lista.data.length, 'paginação tem de respeitar o limit').toBeLessThanOrEqual(5);
    expect(lista.pagination?.page).toBe(1);

    const busca = await corpo(await request.get('/api/projetos?cliente=CRUD%20e2e', { headers: cab(adm) }));
    expect(busca.some((p: any) => p.id === id), 'a busca tem de achar o que acabou de ser criado').toBe(true);

    await request.put(`/api/projetos/${id}`, { headers: cab(coord), data: { cliente: 'CRUD e2e (editado)', ramo: 'Metalurgia' } });
    const dep = await corpo(await request.get(`/api/projetos/${id}`, { headers: cab(adm) }));
    expect(dep.cliente).toBe('CRUD e2e (editado)');
    expect(dep.ramo).toBe('Metalurgia');
    // O PUT é MERGE: campo não enviado não pode ser apagado.
    expect(dep.cnpj).toBe('11222333000181');
    expect(dep.numeroProjeto).toBe('P-900');

    const del = await request.delete(`/api/projetos/${id}`, { headers: cab(coord) });
    expect(del.ok()).toBe(true);
    expect((await request.get(`/api/projetos/${id}`, { headers: cab(adm), failOnStatusCode: false })).status()).toBe(404);
    // Excluir de novo não pode "dar certo" em silêncio.
    expect((await request.delete(`/api/projetos/${id}`, { headers: cab(coord), failOnStatusCode: false })).status()).toBe(404);
  });

  test('CT-037 — acentuação e símbolos sobrevivem à ida e volta', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const nome = 'Açaí & Cia — Ção Ltda';
    const id = await criarProjeto(request, nome);
    const lido = await corpo(await request.get(`/api/projetos/${id}`, { headers: cab(adm) }));
    // Guarda o charset utf8mb4 da conexão MariaDB — sem ele, "ção" voltava corrompido.
    expect(lido.cliente).toBe(nome);
  });

  test('CT-038 — validação do CREATE recusa o que não deve entrar', async ({ request }) => {
    const tk = await token(request, USUARIOS.coordenador);
    const casos: [string, any][] = [
      ['corpo vazio', {}],
      ['sem o obrigatório `cliente`', { cnpj: '1' }],
      ['campo desconhecido (whitelist)', { cliente: 'X', campoInventado: 1 }],
      ['etapa fora do enum', { cliente: 'X', etapa: 'Inexistente' }],
    ];
    for (const [rotulo, data] of casos) {
      const r = await request.post('/api/projetos', { headers: cab(tk), data, failOnStatusCode: false });
      expect(r.status(), `CREATE com ${rotulo}`).toBe(400);
    }
  });

  test('CT-039 — id inválido não vira 500 nem registro fantasma', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    for (const id of ['0', '-1', '999999999999']) {
      expect((await request.get(`/api/projetos/${id}`, { headers: cab(adm), failOnStatusCode: false })).status()).toBe(404);
    }
    expect((await request.get('/api/projetos/abc', { headers: cab(adm), failOnStatusCode: false })).status()).toBe(400);
  });
});

test.describe('CRUD — Usuários', { tag: '@p1' }, () => {
  test('CT-040 — cria, lista sem vazar senha, edita sem apagar o resto', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const s = String(Date.now()).slice(-6);
    const novo = {
      login: `crud${s}`, nome: `Crud Usuario ${s}`, email: `crud${s}@teste.local`,
      senha: 'Teste@123', perfil: 'Consultor', codigoSicla: '777',
    };
    const c = await request.post('/api/usuarios', { headers: cab(adm), data: novo });
    expect(c.ok(), await c.text()).toBe(true);
    const id = (await corpo(c)).id;

    const itens = (await corpo(await request.get('/api/usuarios', { headers: cab(adm) }))).itens;
    expect(itens.some((u: any) => u.id === id)).toBe(true);
    expect(JSON.stringify(itens), 'a listagem não pode expor hash de senha').not.toContain('senhaHash');

    await request.put(`/api/usuarios/${id}`, { headers: cab(adm), data: { setorAtuacao: 'Implantacao' } });
    const dep = (await corpo(await request.get('/api/usuarios', { headers: cab(adm) }))).itens.find((u: any) => u.id === id);
    expect(dep.setorAtuacao).toBe('Implantacao');
    expect(dep.nome, 'edição parcial não pode apagar o nome').toBe(novo.nome);
  });

  test('CT-041 — recusa duplicidade e dado inválido', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const s = String(Date.now()).slice(-6);
    const base = { login: `dup${s}`, nome: `Dup ${s}`, email: `dup${s}@teste.local`, senha: 'Teste@123', perfil: 'Consultor', codigoSicla: '1' };
    expect((await request.post('/api/usuarios', { headers: cab(adm), data: base })).ok()).toBe(true);

    const dupLogin = await request.post('/api/usuarios', { headers: cab(adm), data: { ...base, email: `outro${s}@t.local`, nome: `Outro ${s}` }, failOnStatusCode: false });
    expect(dupLogin.status(), 'login duplicado').toBe(409);
    const dupNome = await request.post('/api/usuarios', { headers: cab(adm), data: { ...base, login: `outro${s}`, email: `outro2${s}@t.local` }, failOnStatusCode: false });
    expect(dupNome.status(), 'NOME duplicado — é a chave de designação').toBe(409);

    for (const [rotulo, data] of [
      ['sem codigoSicla', { login: `a${s}`, nome: `A ${s}`, email: `a${s}@t.local`, senha: 'Teste@123' }],
      ['senha curta', { login: `b${s}`, nome: `B ${s}`, email: `b${s}@t.local`, senha: '123', codigoSicla: '1' }],
      ['e-mail inválido', { login: `c${s}`, nome: `C ${s}`, email: 'nao-e-email', senha: 'Teste@123', codigoSicla: '1' }],
    ] as [string, any][]) {
      const r = await request.post('/api/usuarios', { headers: cab(adm), data, failOnStatusCode: false });
      expect(r.status(), `CREATE ${rotulo}`).toBe(400);
    }
  });
});

test.describe('CRUD — RNS do projeto', { tag: '@p1' }, () => {
  test('CT-042 — ciclo completo e validação', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const administrativo = await token(request, USUARIOS.administrativo);
    const id = await criarProjeto(request, `CRUD RNS ${Date.now()}`);

    expect((await request.post(`/api/projetos/${id}/rns`, { headers: cab(administrativo), data: { tipo: 'RNI', numero: '12345', descricao: 'RNS de teste', situacao: 'Aberta' } })).ok()).toBe(true);
    const lista = await corpo(await request.get(`/api/projetos/${id}/rns`, { headers: cab(adm) }));
    expect(lista).toHaveLength(1);

    await request.patch(`/api/projetos/${id}/rns/${lista[0].id}`, { headers: cab(administrativo), data: { situacao: 'Concluída' } });
    const dep = (await corpo(await request.get(`/api/projetos/${id}/rns`, { headers: cab(adm) })))[0];
    expect(dep.situacao).toBe('Concluída');
    expect(dep.numero, 'edição parcial não apaga o número').toBe('12345');

    for (const [rotulo, data] of [
      ['tipo fora do enum', { tipo: 'INVENTADO' }],
      ['número acima do máximo', { tipo: 'COB', numero: 'N'.repeat(200) }],
    ] as [string, any][]) {
      const r = await request.post(`/api/projetos/${id}/rns`, { headers: cab(administrativo), data, failOnStatusCode: false });
      expect(r.status(), `CREATE RNS com ${rotulo}`).toBe(400);
    }

    await request.delete(`/api/projetos/${id}/rns/${lista[0].id}`, { headers: cab(administrativo) });
    expect(await corpo(await request.get(`/api/projetos/${id}/rns`, { headers: cab(adm) }))).toHaveLength(0);
  });
});

test.describe('CRUD — Preferências do usuário', { tag: '@p1' }, () => {
  test('CT-043 — grava, lê, não vaza para outro usuário e apaga', async ({ request }) => {
    const consultor = await token(request, USUARIOS.consultor);
    const outro = await token(request, USUARIOS.administrativo);

    await request.put('/api/preferencias/crud-e2e', { headers: cab(consultor), data: { valor: { filtro: 'meus' } } });
    expect(JSON.stringify(await corpo(await request.get('/api/preferencias', { headers: cab(consultor) })))).toContain('crud-e2e');
    // O escopo vem do `sub` do token, nunca de parâmetro — por isso não atravessa usuários.
    expect(JSON.stringify(await corpo(await request.get('/api/preferencias', { headers: cab(outro) })))).not.toContain('crud-e2e');

    await request.delete('/api/preferencias/crud-e2e', { headers: cab(consultor) });
    expect(JSON.stringify(await corpo(await request.get('/api/preferencias', { headers: cab(consultor) })))).not.toContain('crud-e2e');
  });
});

test.describe('CRUD — Modelos de e-mail', { tag: '@p1' }, () => {
  test('CT-044 — edita, alterna ativo e o inativo continua visível na tela de administração', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const todos = async () =>
      (await corpo(await request.get('/api/config/modelos-email?apenasAtivos=false', { headers: cab(adm) }))).itens;

    const alvo = (await todos()).find((m: any) => m.slug === 'passo-15');
    expect(alvo, 'o modelo passo-15 é semeado no boot').toBeTruthy();
    const original = { nome: alvo.nome, assunto: alvo.assunto, corpo: alvo.corpo, etapa: alvo.etapa, ativo: true };

    await request.post(`/api/config/modelos-email/${alvo.id}`, { headers: cab(adm), data: { ...original, assunto: 'Assunto CRUD {{CLIENTE}}' } });
    expect((await todos()).find((m: any) => m.id === alvo.id).assunto).toBe('Assunto CRUD {{CLIENTE}}');

    await request.post(`/api/config/modelos-email/${alvo.id}/toggle`, { headers: cab(adm) });
    const inativo = (await todos()).find((m: any) => m.id === alvo.id);
    // A tela de administração lista com `apenasAtivos=false` justamente para o inativo
    // continuar alcançável — senão desativar seria uma porta de mão única.
    expect(inativo, 'o modelo inativo tem de continuar na lista de administração').toBeTruthy();
    expect(inativo.ativo).toBe(false);

    await request.post(`/api/config/modelos-email/${alvo.id}/toggle`, { headers: cab(adm) });
    await request.post(`/api/config/modelos-email/${alvo.id}`, { headers: cab(adm), data: original });
  });

  test('CT-045 — id inexistente devolve 404, e não-ADM é recusado', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const consultor = await token(request, USUARIOS.consultor);
    const inex = await request.post('/api/config/modelos-email/99999', {
      headers: cab(adm), data: { nome: 'x', assunto: 'x', corpo: 'x', etapa: '', ativo: true }, failOnStatusCode: false,
    });
    expect(inex.status()).toBe(404);
    const semPerm = await request.post('/api/config/modelos-email/1', { headers: cab(consultor), data: { nome: 'x', assunto: 'x', corpo: 'x', etapa: '', ativo: true }, failOnStatusCode: false });
    expect(semPerm.status()).toBe(403);
  });
});
