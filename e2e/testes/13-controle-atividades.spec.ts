import { test, expect, APIRequestContext } from '@playwright/test';
import { USUARIOS, entrarComSucesso, projetoNoPasso, token } from '../apoio/painel';

/**
 * Controle de Atividades — o quadro (Kanban) por cliente, entregue em 2026-09-01.
 *
 * É o módulo do Painel em que um engano **não dá erro: dá vazamento**. A fronteira que ele
 * protege é Rech ↔ cliente (nunca consultor ↔ consultor), e ela se apoia em três regras que
 * só valem se estiverem ligadas às ROTAS — e é isso que estes casos provam, porque as
 * funções puras de `acesso.ts` já têm teste de unidade e passariam mesmo que ninguém as
 * chamasse:
 *
 * 1. **O cliente alcança só o próprio código.** O quadro do outro cliente não existe para ele.
 * 2. **O cartão nasce fechado** ao cliente — o bastidor da Rech não vaza por padrão. A exceção
 *    é o cartão que o PRÓPRIO cliente abre (uma solicitação), que nasce compartilhado.
 * 3. **Ler é geral, escrever é do responsável.** Interno não designado lê tudo e não mexe em nada.
 */

const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

/** Códigos de cliente dos dois usuários-cliente semeados (`semear-usuarios.mjs`). */
const COD_ACME = '3180';
const COD_OUTRO = '3729';

/** Quem responde pelos quadros nos casos abaixo: `projetoNoPasso` designa este nome. */
const RESPONSAVEL = 'cesar.consultor';

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Abre (ou reaproveita) o quadro do código informado, pelo consultor designado ao projeto. */
async function quadroDoCliente(
  request: APIRequestContext,
  codigo: string,
  nomeCliente: string,
) {
  const projetoId = await projetoNoPasso(request, `${nomeCliente} ${Date.now()}`, 0);
  const t = await token(request, RESPONSAVEL);
  const r = await request.post('/api/atividades/quadros', {
    headers: cab(t),
    data: { codigoClienteSicla: codigo, nomeCliente, projetoId },
  });
  expect(r.ok(), `abrir o quadro de ${codigo}: ${r.status()} ${await r.text()}`).toBeTruthy();
  return { quadro: desembrulhar(await r.json()), projetoId };
}

async function lerQuadro(request: APIRequestContext, login: string, codigo: string) {
  const t = await token(request, login);
  return request.get(`/api/atividades/quadros/${codigo}`, { headers: cab(t) });
}

test.describe('Controle de Atividades — a fronteira Rech ↔ cliente', { tag: '@p0' }, () => {
  test('CT-127 — o quadro nasce com as colunas padrão, e o Bastidor Rech fechado ao cliente', async ({
    request,
  }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');

    const visaoInterna = desembrulhar(
      await (await lerQuadro(request, RESPONSAVEL, COD_ACME)).json(),
    );
    const titulos = (visaoInterna.listas as any[]).map((l) => l.titulo);
    expect(titulos).toEqual([
      'A fazer',
      'Em andamento',
      'Com o cliente',
      'Concluído',
      'Bastidor Rech',
    ]);
    const bastidor = (visaoInterna.listas as any[]).find((l) => l.titulo === 'Bastidor Rech');
    expect(bastidor.visivelCliente, 'o bastidor da Rech não é compartilhado').toBe(false);
    expect(visaoInterna.souResponsavel, 'quem abriu responde pelo quadro').toBe(true);
    expect(visaoInterna.podeEditar).toBe(true);

    // O cliente lê o MESMO quadro — recortado: a coluna interna não chega até ele.
    const visaoCliente = desembrulhar(
      await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json(),
    );
    expect(
      (visaoCliente.listas as any[]).map((l) => l.titulo),
      'a coluna interna não pode aparecer para o cliente',
    ).not.toContain('Bastidor Rech');
    expect(visaoCliente.interno).toBe(false);
    expect(visaoCliente.podeEditar, 'cliente não mexe na estrutura do quadro').toBe(false);
  });

  test('CT-128 — um cliente não alcança o quadro do outro', async ({ request }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    await quadroDoCliente(request, COD_OUTRO, 'Cliente CONCORRENTE');

    // Cada um lê o seu...
    expect((await lerQuadro(request, 'cliente.acme', COD_ACME)).ok()).toBeTruthy();
    expect((await lerQuadro(request, 'cliente.outro', COD_OUTRO)).ok()).toBeTruthy();

    // ...e o do outro não existe para ele.
    const cruzado = await lerQuadro(request, 'cliente.acme', COD_OUTRO);
    expect(
      [403, 404],
      'o quadro do outro cliente tem de ser inalcançável',
    ).toContain(cruzado.status());
    const cruzado2 = await lerQuadro(request, 'cliente.outro', COD_ACME);
    expect([403, 404]).toContain(cruzado2.status());

    // E a listagem de quadros do cliente não pode denunciar a existência do outro.
    const t = await token(request, 'cliente.acme');
    const lista = desembrulhar(
      await (await request.get('/api/atividades/quadros', { headers: cab(t) })).json(),
    );
    const codigos = [...(lista.meus ?? []), ...(lista.demais ?? [])].map(
      (q: any) => q.codigoClienteSicla,
    );
    expect(codigos, 'a listagem do cliente tem de trazer o quadro dele').toContain(COD_ACME);
    expect(codigos, 'e não pode denunciar a existência do quadro do outro').not.toContain(
      COD_OUTRO,
    );

    // Um interno, no mesmo endpoint, enxerga os dois — é a prova de que o recorte acima é do
    // CLIENTE, e não uma lista que por acaso veio vazia.
    const interno = desembrulhar(
      await (
        await request.get('/api/atividades/quadros', {
          headers: cab(await token(request, RESPONSAVEL)),
        })
      ).json(),
    );
    const todos = [...(interno.meus ?? []), ...(interno.demais ?? [])].map(
      (q: any) => q.codigoClienteSicla,
    );
    expect(todos).toEqual(expect.arrayContaining([COD_ACME, COD_OUTRO]));
  });

  test('CT-129 — cartão criado pelo interno nasce FECHADO; compartilhar é ato explícito', async ({
    request,
  }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const dono = await token(request, RESPONSAVEL);
    const visao = desembrulhar(await (await lerQuadro(request, RESPONSAVEL, COD_ACME)).json());
    const aFazer = (visao.listas as any[]).find((l) => l.titulo === 'A fazer');

    const titulo = `Bastidor ${Date.now()}`;
    const criado = desembrulhar(
      await (
        await request.post('/api/atividades/cartoes', {
          headers: cab(dono),
          data: { listaId: aFazer.id, titulo },
        })
      ).json(),
    );
    expect(criado.visivelCliente, 'cartão interno nasce FECHADO ao cliente').toBe(false);

    const antes = desembrulhar(await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json());
    expect(
      (antes.cartoes as any[]).map((c) => c.titulo),
      'antes de compartilhar, o cliente não vê o cartão',
    ).not.toContain(titulo);

    // Compartilhar é uma ação à parte — e aí, sim, o cartão aparece.
    const abrir = await request.patch(`/api/atividades/cartoes/${criado.id}/visibilidade`, {
      headers: cab(dono),
      data: { visivelCliente: true },
    });
    expect(abrir.ok()).toBeTruthy();

    const depois = desembrulhar(await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json());
    expect((depois.cartoes as any[]).map((c) => c.titulo)).toContain(titulo);
  });

  test('CT-130 — o cartão aberto pelo CLIENTE nasce compartilhado (é uma solicitação)', async ({
    request,
  }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const cliente = await token(request, 'cliente.acme');
    const visao = desembrulhar(
      await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json(),
    );
    expect(visao.podeCriarCartao, 'o cliente abre solicitação').toBe(true);
    const coluna = (visao.listas as any[])[0];

    const titulo = `Solicitação ${Date.now()}`;
    const r = await request.post('/api/atividades/cartoes', {
      headers: cab(cliente),
      data: { listaId: coluna.id, titulo },
    });
    expect(r.ok(), `criar cartão como cliente: ${r.status()} ${await r.text()}`).toBeTruthy();
    const criado = desembrulhar(await r.json());
    expect(
      criado.visivelCliente,
      'uma solicitação que nascesse interna ficaria invisível para quem a abriu',
    ).toBe(true);

    // A Rech enxerga a solicitação do cliente.
    const interna = desembrulhar(await (await lerQuadro(request, RESPONSAVEL, COD_ACME)).json());
    expect((interna.cartoes as any[]).map((c) => c.titulo)).toContain(titulo);
  });

  test('CT-131 — o cliente não empurra o próprio cartão para dentro do bastidor da Rech', async ({
    request,
  }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const dono = await token(request, RESPONSAVEL);
    const cliente = await token(request, 'cliente.acme');

    const visaoInterna = desembrulhar(
      await (await lerQuadro(request, RESPONSAVEL, COD_ACME)).json(),
    );
    const bastidor = (visaoInterna.listas as any[]).find((l) => l.titulo === 'Bastidor Rech');
    const compartilhada = (visaoInterna.listas as any[]).find((l) => l.titulo === 'A fazer');

    // Um cartão que o cliente alcança...
    const cartao = desembrulhar(
      await (
        await request.post('/api/atividades/cartoes', {
          headers: cab(dono),
          data: { listaId: compartilhada.id, titulo: `Visível ${Date.now()}` },
        })
      ).json(),
    );
    await request.patch(`/api/atividades/cartoes/${cartao.id}/visibilidade`, {
      headers: cab(dono),
      data: { visivelCliente: true },
    });

    // ...ele pode mover DENTRO do que é compartilhado...
    const emAndamento = (visaoInterna.listas as any[]).find((l) => l.titulo === 'Em andamento');
    const permitido = await request.patch(`/api/atividades/cartoes/${cartao.id}/mover`, {
      headers: cab(cliente),
      data: { listaId: emAndamento.id, indice: 0 },
    });
    expect(permitido.ok(), 'mover entre colunas compartilhadas é do cliente').toBeTruthy();

    // ...e NÃO para a coluna interna.
    const proibido = await request.patch(`/api/atividades/cartoes/${cartao.id}/mover`, {
      headers: cab(cliente),
      data: { listaId: bastidor.id, indice: 0 },
    });
    expect(
      [403, 404],
      'o destino interno tem de ser recusado — senão o cliente entra no bastidor',
    ).toContain(proibido.status());

    // O cartão continua onde estava.
    const depois = desembrulhar(await (await lerQuadro(request, RESPONSAVEL, COD_ACME)).json());
    const atual = (depois.cartoes as any[]).find((c) => c.id === cartao.id);
    expect(atual.listaId, 'a recusa não pode ter movido o cartão pela metade').toBe(
      emAndamento.id,
    );
  });

  test('CT-132 — interno não designado LÊ o quadro e não ESCREVE nele', async ({ request }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const outro = await token(request, USUARIOS.levantador);

    // Ler é geral: a fronteira do módulo é Rech ↔ cliente, não consultor ↔ consultor.
    const leitura = await lerQuadro(request, USUARIOS.levantador, COD_ACME);
    expect(leitura.ok(), 'todo interno lê todos os quadros').toBeTruthy();
    const visao = desembrulhar(await leitura.json());
    expect(visao.souResponsavel).toBe(false);
    expect(visao.podeEditar, 'quem não responde pelo quadro fica em consulta').toBe(false);
    expect(visao.podeCriarCartao).toBe(false);

    const coluna = (visao.listas as any[])[0];

    // Escrever é do responsável — e a tela já não oferece, mas a API é quem tem de recusar.
    const cartao = await request.post('/api/atividades/cartoes', {
      headers: cab(outro),
      data: { listaId: coluna.id, titulo: 'não deveria entrar' },
    });
    expect(cartao.status(), 'criar cartão em quadro alheio').toBe(403);

    const lista = await request.post(`/api/atividades/quadros/${COD_ACME}/listas`, {
      headers: cab(outro),
      data: { titulo: 'não deveria entrar' },
    });
    expect(lista.status(), 'criar coluna em quadro alheio').toBe(403);
  });

  test('CT-134 — o cliente edita a solicitação que abriu, e não o cartão da Rech', async ({
    request,
  }) => {
    // Pedido do usuário em 2026-09-03: do lado cliente a descrição vinha somente-leitura, e
    // quem abria uma solicitação não tinha onde dizer do que ela se tratava.
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const dono = await token(request, RESPONSAVEL);
    const cliente = await token(request, 'cliente.acme');
    const visao = desembrulhar(
      await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json(),
    );
    const coluna = (visao.listas as any[])[0];

    // ...a solicitação que o próprio cliente abriu
    const minha = desembrulhar(
      await (
        await request.post('/api/atividades/cartoes', {
          headers: cab(cliente),
          data: { listaId: coluna.id, titulo: `Solicitação ${Date.now()}` },
        })
      ).json(),
    );
    const editar = await request.patch(`/api/atividades/cartoes/${minha.id}`, {
      headers: cab(cliente),
      data: { descricao: 'Preciso de ajuda na apuração do ICMS.' },
    });
    expect(editar.ok(), `editar a própria solicitação: ${editar.status()}`).toBeTruthy();

    const depois = desembrulhar(
      await (await lerQuadro(request, 'cliente.acme', COD_ACME)).json(),
    );
    expect(
      (depois.cartoes as any[]).find((c) => c.id === minha.id).descricao,
    ).toBe('Preciso de ajuda na apuração do ICMS.');

    // ...e um cartão da Rech, compartilhado com ele, continua sendo da Rech
    const daRech = desembrulhar(
      await (
        await request.post('/api/atividades/cartoes', {
          headers: cab(dono),
          data: { listaId: coluna.id, titulo: `Da Rech ${Date.now()}` },
        })
      ).json(),
    );
    await request.patch(`/api/atividades/cartoes/${daRech.id}/visibilidade`, {
      headers: cab(dono),
      data: { visivelCliente: true },
    });
    const proibido = await request.patch(`/api/atividades/cartoes/${daRech.id}`, {
      headers: cab(cliente),
      data: { descricao: 'reescrevendo o que a Rech redigiu' },
    });
    expect(
      proibido.status(),
      'o cliente não pode falar pela Rech no quadro dela',
    ).toBe(403);

    // E o vínculo com o projeto continua sendo da Rech, mesmo no cartão dele.
    const vinculo = await request.patch(`/api/atividades/cartoes/${minha.id}`, {
      headers: cab(cliente),
      data: { projetoId: 1 },
    });
    expect(vinculo.status(), 'projetoId é administrativo, não conteúdo').toBe(403);
  });

  test('CT-135 — os consultores oferecidos são só os designados no projeto', async ({
    request,
  }) => {
    // Pedido do usuário em 2026-09-03: antes isto devolvia o cadastro inteiro de usuários
    // internos, e dava para apontar um cartão para quem não atende aquele cliente.
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');

    const lista = async (login: string) => {
      const r = await request.get(
        `/api/atividades/consultores?codigo=${COD_ACME}`,
        { headers: cab(await token(request, login)) },
      );
      expect(r.ok(), `consultores para ${login}: ${r.status()}`).toBeTruthy();
      return (desembrulhar(await r.json()) as any[]).map((x) => x.nome);
    };

    const paraOConsultor = await lista(RESPONSAVEL);
    // `projetoNoPasso` designa estes três; o levantador fica de fora por regra.
    expect(paraOConsultor).toEqual(expect.arrayContaining(['Cesar Consultor', 'Gabriel GCI']));
    expect(paraOConsultor, 'o levantador não é designável em cartão').not.toContain(
      'Lucia Levantadora',
    );
    // O corte que interessa: gente da casa que NÃO atende este cliente não aparece.
    expect(paraOConsultor, 'quem não está no projeto não pode ser designado').not.toContain(
      'Administrativo Teste',
    );
    expect(paraOConsultor).not.toContain('Administrador');

    // O cliente escolhe a quem endereça na MESMA lista.
    expect(await lista('cliente.acme')).toEqual(paraOConsultor);

    // E quem não alcança o quadro não descobre quem atende o cliente por aqui.
    const decliente = await request.get(
      `/api/atividades/consultores?codigo=${COD_OUTRO}`,
      { headers: cab(await token(request, 'cliente.acme')) },
    );
    expect([403, 404]).toContain(decliente.status());
  });

  test('CT-133 — sem o menu `controle_atividades`, nem a tela nem a API respondem', async ({
    page,
    request,
  }) => {
    await quadroDoCliente(request, COD_ACME, 'Cliente ACME');
    const adm = await token(request, USUARIOS.adm);
    const fechar = (nivel: string) =>
      request.put('/api/permissoes/papel', {
        headers: cab(adm),
        data: { papel: 'Levantador', menu: 'controle_atividades', nivel },
      });

    try {
      await fechar('nada');
      const t = await token(request, USUARIOS.levantador);
      const r = await request.get('/api/atividades/quadros', { headers: cab(t) });
      expect(r.status(), 'sem o menu, a listagem de quadros é 403').toBe(403);

      await entrarComSucesso(page, USUARIOS.levantador);
      await page.goto('/home', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('nav, aside').first()).not.toContainText('Quadro por cliente');
    } finally {
      await fechar('alteracao');
    }
  });
});
