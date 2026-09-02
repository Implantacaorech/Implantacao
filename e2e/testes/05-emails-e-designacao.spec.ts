import { test, expect } from '@playwright/test';
import { projetoNoPasso, token, USUARIOS } from '../apoio/painel';

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const dados = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

/**
 * RN-7 — "A descrição do passo 5 viaja no e-mail do passo 5".
 *
 * A prévia era montada quando o formulário ABRIA, antes de a pessoa escrever, e a tela
 * devolvia esse corpo já substituído ao concluir. Resultado: o Administrativo recebia
 * "Descrição do Comercial:" em branco — a regra nunca se cumpria pelo caminho da tela.
 */
test.describe('RN-7 — a descrição do passo 5 chega ao e-mail', { tag: '@p1' }, () => {
  const DESCRICAO = 'Fechado em 12x, desconto de 8%, virada em outubro.';

  test('CT-030 — a prévia remontada já contém o que foi escrito', async ({ request }) => {
    const pid = await projetoNoPasso(request, 'RN7 Previa', 4);
    const tk = await token(request, USUARIOS.comercial);
    const previa = dados(
      await (
        await request.get(
          `/api/projetos/${pid}/passos/5/email?descricao=${encodeURIComponent(DESCRICAO)}`,
          { headers: cab(tk) },
        )
      ).json(),
    );
    expect(previa.corpo).toContain(DESCRICAO);
  });

  test('CT-031 — o e-mail registrado carrega a descrição, tendo sido redigido ou não', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);

    // (a) caminho da TELA: prévia com a descrição -> corpo revisado -> concluir
    const pidA = await projetoNoPasso(request, 'RN7 Tela', 4);
    const tk = await token(request, USUARIOS.comercial);
    const previa = dados(
      await (
        await request.get(
          `/api/projetos/${pidA}/passos/5/email?descricao=${encodeURIComponent(DESCRICAO)}`,
          { headers: cab(tk) },
        )
      ).json(),
    );
    await request.post(`/api/projetos/${pidA}/passos/5/concluir`, {
      headers: cab(tk),
      data: {
        observacao: DESCRICAO,
        email: { para: previa.para, assunto: previa.assunto, corpo: previa.corpo },
      },
    });
    const eA = (dados(await (await request.get(`/api/projetos/${pidA}/emails`, { headers: cab(adm) })).json()) ?? [])
      .find((e: any) => e.passo === 5);
    expect(eA?.corpo, 'redigido na tela').toContain(DESCRICAO);

    // (b) sem redigir: só a observação, o modelo resolve o token
    const pidB = await projetoNoPasso(request, 'RN7 Sem Redigir', 4);
    await request.post(`/api/projetos/${pidB}/passos/5/concluir`, {
      headers: cab(tk), data: { observacao: DESCRICAO },
    });
    const eB = (dados(await (await request.get(`/api/projetos/${pidB}/emails`, { headers: cab(adm) })).json()) ?? [])
      .find((e: any) => e.passo === 5);
    expect(eB?.corpo, 'sem redigir').toContain(DESCRICAO);
  });
});

/**
 * A tela Modelos de E-mail oferece 25 variáveis; o montador dos passos resolvia 13. Um ADM
 * que inserisse `{{CONTATO_TEL}}` num modelo `passo-N` mandava o token LITERAL — inclusive
 * nos passos 15, 16 e 21, que vão ao cliente. `TOKENS_PASSO` passou a herdar `VAR_CAMPO`.
 */
test('CT-032 — nenhum token do seletor de modelos sai literal no e-mail do passo', { tag: '@p1' }, async ({
  request,
}) => {
  const adm = await token(request, USUARIOS.adm);
  const coord = await token(request, USUARIOS.coordenador);

  const modelos = dados(await (await request.get('/api/config/modelos-email', { headers: cab(adm) })).json());
  const lista = Array.isArray(modelos) ? modelos : (modelos?.itens ?? []);
  const m15 = lista.find((m: any) => m.slug === 'passo-15');
  expect(m15, 'o modelo passo-15 é semeado no boot').toBeTruthy();

  const corpo =
    'Fone: {{CONTATO_TEL}} | Ramo: {{RAMO}} | Horas: {{HORAS_COBRADAS}} | ' +
    'Consultor A: {{CONSULTOR_A}} | Resp: {{RESPONSAVEL}} | Proposta: {{NUMERO_PROPOSTA}}';
  await request.post(`/api/config/modelos-email/${m15.id}`, {
    headers: cab(adm),
    data: { nome: m15.nome, assunto: 'Boas-vindas {{CLIENTE}}', corpo, etapa: m15.etapa, ativo: true },
  });

  const criado = dados(await (await request.post('/api/projetos', {
    headers: cab(coord),
    data: {
      cliente: 'Tokens LTDA', ramo: 'Metalurgia', horasCobradas: '80',
      numeroProposta: 'PROP-42', responsavel: 'Ana Administrativo',
      contatoTel: '(51) 3333-4444', contatoNome: 'Joao Contato',
    },
  })).json());
  await request.patch(`/api/projetos/${criado.id}/pessoas`, {
    headers: cab(coord), data: { papel: 'consultor', pessoas: ['Cesar Consultor'] },
  });

  const previa = dados(await (await request.get(`/api/projetos/${criado.id}/passos/15/email`, { headers: cab(adm) })).json());
  const texto = `${previa.assunto} ${previa.corpo}`;
  expect(texto.match(/\{\{[A-Z_]+\}\}/g), 'token não resolvido indo ao cliente').toBeNull();
  for (const v of ['(51) 3333-4444', 'Metalurgia', '80', 'Ana Administrativo', 'PROP-42']) {
    expect(texto).toContain(v);
  }

  // devolve o modelo ao padrão para não contaminar os outros testes
  await request.post(`/api/config/modelos-email/${m15.id}`, {
    headers: cab(adm),
    data: { nome: m15.nome, assunto: m15.assunto, corpo: m15.corpo, etapa: m15.etapa, ativo: true },
  });
});

/**
 * A macro-etapa é derivada do primeiro passo pendente, e as telas (stepper, funil, Kanban,
 * "Avançar") leem a ORDEM do array `ETAPAS`. Enquanto `Designação` vinha depois de `Projeto`
 * nesse array — mas antes dele nos passos —, o projeto REGREDIA ao sair da Designação.
 */
test('CT-033 — a macro-etapa nunca regride enquanto os 21 passos avançam', { tag: '@p0' }, async ({
  request,
}) => {
  const ORDEM = ['Agendamento', 'Levantamento', 'Designação', 'Projeto', 'Cronograma e Check-list', 'Encerramento'];
  const adm = await token(request, USUARIOS.adm);
  const pid = await projetoNoPasso(request, 'Ordem das Etapas', 0);

  const marcacao: Record<number, boolean> = { 7: true, 12: true };
  const redige = [4, 5, 11, 15, 16, 17, 18, 19, 20, 21];
  let anterior = -1;
  const trilha: string[] = [];

  for (let n = 1; n <= 21; n++) {
    const data: any = {};
    if (marcacao[n]) { data.marcado = true; data.dataMarcada = '2026-08-05'; }
    if (redige.includes(n)) data.email = { para: ['x@y.z'], assunto: 'a', corpo: 'b' };
    const r = await request.post(`/api/projetos/${pid}/passos/${n}/concluir`, { headers: cab(adm), data });
    expect(r.ok(), `passo ${n}: ${await r.text()}`).toBe(true);
    if (n === 11 || n === 19) {
      await request.post(`/api/projetos/${pid}/passos/${n}/conferir`, { headers: cab(adm) });
    }
    const proj = dados(await (await request.get(`/api/projetos/${pid}`, { headers: cab(adm) })).json());
    const idx = ORDEM.indexOf(proj.etapa);
    expect(idx, `etapa desconhecida "${proj.etapa}" após o passo ${n}`).toBeGreaterThanOrEqual(0);
    expect(idx, `regrediu para "${proj.etapa}" após o passo ${n} — trilha: ${trilha.join(' -> ')}`)
      .toBeGreaterThanOrEqual(anterior);
    if (idx !== anterior) trilha.push(`${n}:${proj.etapa}`);
    anterior = idx;
  }

  const cabecalho = dados(await (await request.get(`/api/projetos/${pid}/cabecalho`, { headers: cab(adm) })).json());
  expect(cabecalho.stepper.map((s: any) => s.nome)).toEqual(ORDEM);
});

/** O passo 8 é do COORDENADOR, mas a rota que salva a equipe também aceita o Administrativo
 * (que a mantém ao longo do projeto). Salvar a lista não pode fechar o passo dele. */
test.describe('passo 8 — salvar a equipe só conclui para quem responde pelo passo', { tag: '@p0' }, () => {
  async function projetoNoPasso7(request: any, cliente: string) {
    const adm = await token(request, USUARIOS.adm);
    const coord = await token(request, USUARIOS.coordenador);
    const criado = dados(await (await request.post('/api/projetos', { headers: cab(coord), data: { cliente } })).json());
    await request.put(`/api/projetos/${criado.id}`, { headers: cab(adm), data: { gci: 'Gabriel GCI' } });
    await request.patch(`/api/projetos/${criado.id}/pessoas`, {
      headers: cab(coord), data: { papel: 'levantador', pessoas: ['Lucia Levantadora'] },
    });
    for (let n = 1; n <= 7; n++) {
      const data: any = {};
      if (n === 7) { data.marcado = true; data.dataMarcada = '2026-08-05'; }
      if ([4, 5].includes(n)) data.email = { para: ['x@y.z'], assunto: 'a', corpo: 'b' };
      await request.post(`/api/projetos/${criado.id}/passos/${n}/concluir`, { headers: cab(adm), data });
    }
    return criado.id as number;
  }

  async function passo8(request: any, pid: number) {
    const adm = await token(request, USUARIOS.adm);
    const lista = dados(await (await request.get(`/api/projetos/${pid}/passos`, { headers: cab(adm) })).json());
    return lista.find((p: any) => p.numero === 8);
  }

  test('CT-034 — Administrativo salvando a equipe NÃO conclui o passo 8', async ({ request }) => {
    const pid = await projetoNoPasso7(request, 'Passo8 Adm');
    const tk = await token(request, USUARIOS.administrativo);
    await request.patch(`/api/projetos/${pid}/pessoas`, {
      headers: cab(tk), data: { papel: 'consultor', pessoas: ['Cesar Consultor'] },
    });
    const p8 = await passo8(request, pid);
    expect(p8.concluido, `concluído por "${p8.concluidoPor}"`).toBe(false);
  });

  test('CT-035 — Coordenador salvando a equipe conclui o passo 8', async ({ request }) => {
    const pid = await projetoNoPasso7(request, 'Passo8 Coord');
    const tk = await token(request, USUARIOS.coordenador);
    await request.patch(`/api/projetos/${pid}/pessoas`, {
      headers: cab(tk), data: { papel: 'consultor', pessoas: ['Cesar Consultor'] },
    });
    const p8 = await passo8(request, pid);
    expect(p8.concluido).toBe(true);
  });
});
