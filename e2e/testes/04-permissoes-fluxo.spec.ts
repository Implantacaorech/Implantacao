import { test, expect } from '@playwright/test';
import { projetoNoPasso, token, USUARIOS } from '../apoio/painel';

/**
 * RN-10 — "não basta ter o perfil: a pessoa tem de estar designada NAQUELE projeto".
 *
 * Estes testes atacam a regra por FORA do `PassosController`, que era o único lugar onde ela
 * valia. Até 2026-08-05 todos passavam por cima dela: anexar um arquivo rotulado `termo`,
 * gerar o documento (mesmo o modelo em branco), reescrever `gci` por `PUT /projetos/:id` ou
 * criar projeto por `POST /fluxo/criar` fechavam passos — vários irreversíveis — em nome de
 * "sistema". O gate agora vive em `DocumentosService.registrarDocumento` (via
 * `PassosService.podeExecutarPasso`) e nas permissões das rotas.
 */

const cab = (t: string) => ({ Authorization: `Bearer ${t}` });
const dados = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

async function passo(request: any, pid: number, numero: number) {
  const tk = await token(request, USUARIOS.adm);
  const lista = dados(await (await request.get(`/api/projetos/${pid}/passos`, { headers: cab(tk) })).json());
  return lista.find((p: any) => p.numero === numero);
}

test.describe('RN-10 — designação por projeto vale em todos os caminhos', () => {
  test.describe(() => {
    test('anexar documento com tipo="termo" não pode concluir o passo 18', async ({ request }) => {
      const pid = await projetoNoPasso(request, 'RN10 Anexo Termo', 17);
      const tk = await token(request, 'consultor2'); // NÃO designado no projeto

      const fd = new FormData();
      fd.append('arquivo', new Blob(['qualquer coisa']), 'qualquer.docx');
      fd.append('tipo', 'termo');
      await request.post(`/api/projetos/${pid}/anexar`, {
        headers: cab(tk), multipart: fd as any, failOnStatusCode: false,
      });

      const p18 = await passo(request, pid, 18);
      expect(p18.concluido, `passo 18 concluído por "${p18.concluidoPor}"`).toBe(false);
    });

    test('gerar o Termo não pode fechar o passo 18 de quem não é o consultor designado', async ({ request }) => {
      const pid = await projetoNoPasso(request, 'RN10 Gerar Termo', 17);
      const tk = await token(request, 'consultor2');
      await request.post(`/api/projetos/${pid}/gerar-layout/termo`, {
        headers: cab(tk), failOnStatusCode: false,
      });
      const p18 = await passo(request, pid, 18);
      expect(p18.concluido, `passo 18 concluído por "${p18.concluidoPor}"`).toBe(false);
    });

    test('baixar o Termo EM BRANCO (modo=modelo) não pode concluir o passo 18', async ({ request }) => {
      const pid = await projetoNoPasso(request, 'RN10 Termo Branco', 17);
      const tk = await token(request, USUARIOS.administrativo);
      await request.post(`/api/projetos/${pid}/gerar-layout/termo?modo=modelo`, {
        headers: cab(tk), failOnStatusCode: false,
      });
      const p18 = await passo(request, pid, 18);
      expect(p18.concluido, 'ver o modelo em branco não é entregar o Termo').toBe(false);
    });

    test('PUT /projetos/:id não pode deixar alguém se autodesignar GCI e concluir o passo 10', async ({ request }) => {
      const pid = await projetoNoPasso(request, 'RN10 Auto GCI', 8);
      const tk = await token(request, 'gci2'); // GCI de outro projeto

      await request.put(`/api/projetos/${pid}`, {
        headers: cab(tk), data: { gci: 'Gustavo GCI Outro' }, failOnStatusCode: false,
      });
      const r = await request.post(`/api/projetos/${pid}/passos/10/concluir`, {
        headers: cab(tk),
        data: { email: { para: ['x@teste.local'], assunto: 'a', corpo: 'b' } },
        failOnStatusCode: false,
      });
      expect(r.status(), 'quem não é o GCI do projeto não conclui a Criação do Projeto').toBeGreaterThanOrEqual(400);
    });

    test('quem só tem CONSULTA na carteira não pode reescrever a ficha', async ({ request }) => {
      const pid = await projetoNoPasso(request, 'RN10 Consulta Escreve', 1);
      const tk = await token(request, USUARIOS.comercial); // nível 'consulta' em carteira
      await request.put(`/api/projetos/${pid}`, {
        headers: cab(tk), data: { cliente: 'REESCRITO' }, failOnStatusCode: false,
      });
      const adm = await token(request, USUARIOS.adm);
      const proj = dados(await (await request.get(`/api/projetos/${pid}`, { headers: cab(adm) })).json());
      expect(proj.cliente).not.toBe('REESCRITO');
    });

    test('POST /fluxo/criar não pode concluir o passo 1 para quem não cadastra cliente', async ({ request }) => {
      const tk = await token(request, USUARIOS.consultor);
      const r = await request.post('/api/fluxo/criar', {
        headers: cab(tk), data: { cliente: 'RN10 Fluxo Sem Gate' }, failOnStatusCode: false,
      });
      expect(r.status(), 'o passo 1 é do Comercial').toBeGreaterThanOrEqual(400);
    });
  });

  test('o gate de ORDEM continua valendo na auto-conclusão', async ({ request }) => {
    const pid = await projetoNoPasso(request, 'RN10 Ordem Auto', 8);
    const tk = await token(request, USUARIOS.consultor);
    await request.post(`/api/projetos/${pid}/gerar-layout/termo`, {
      headers: cab(tk), failOnStatusCode: false,
    });
    const p18 = await passo(request, pid, 18);
    expect(p18.concluido, 'sem o passo 17, o 18 não pode fechar').toBe(false);
  });
});

test.describe('Destinatários dos e-mails do processo', () => {
  test('com UM GCI, o e-mail do passo 8 chega ao GCI', async ({ request }) => {
    const pid = await projetoNoPasso(request, 'Email 1 GCI', 8);
    const tk = await token(request, USUARIOS.adm);
    const lista = dados(await (await request.get(`/api/projetos/${pid}/emails`, { headers: cab(tk) })).json());
    const e8 = lista.find((e: any) => e.passo === 8);
    expect(e8?.para ?? '').toContain('gci@teste.local');
  });

  test('com DOIS GCIs, o e-mail do passo 8 ainda tem de chegar a um GCI', async ({ request }) => {
    const adm = await token(request, USUARIOS.adm);
    const coord = await token(request, USUARIOS.coordenador);
    const criado = dados(await (await request.post('/api/projetos', {
      headers: cab(coord), data: { cliente: 'Email 2 GCIs' },
    })).json());
    const pid = criado.id;
    await request.put(`/api/projetos/${pid}`, {
      headers: cab(adm), data: { gci: 'Gabriel GCI, Gustavo GCI Outro' },
    });
    await request.patch(`/api/projetos/${pid}/pessoas`, {
      headers: cab(coord), data: { papel: 'levantador', pessoas: ['Lucia Levantadora'] },
    });
    await request.patch(`/api/projetos/${pid}/pessoas`, {
      headers: cab(coord), data: { papel: 'consultor', pessoas: ['Cesar Consultor'] },
    });
    const redige = [4, 5];
    for (let n = 1; n <= 8; n++) {
      const data: any = {};
      if (n === 7) { data.marcado = true; data.dataMarcada = '2026-08-05'; }
      if (redige.includes(n)) data.email = { para: ['x@teste.local'], assunto: 'a', corpo: 'b' };
      await request.post(`/api/projetos/${pid}/passos/${n}/concluir`, { headers: cab(adm), data });
    }
    const lista = dados(await (await request.get(`/api/projetos/${pid}/emails`, { headers: cab(adm) })).json());
    const e8 = lista.find((e: any) => e.passo === 8);
    expect(e8?.para ?? '', 'nenhum dos dois GCIs foi avisado de que responde pela implantação')
      .toMatch(/gci@teste\.local|gci2@teste\.local/);
  });
});

test.describe('RN-4 — data da assinatura', () => {
  test('data inexistente (2026-13-45) não pode fechar o passo 7', async ({ request }) => {
    const pid = await projetoNoPasso(request, 'RN4 Data Invalida', 6);
    const tk = await token(request, USUARIOS.administrativo);
    const r = await request.post(`/api/projetos/${pid}/passos/7/concluir`, {
      headers: cab(tk), data: { marcado: true, dataMarcada: '2026-13-45' }, failOnStatusCode: false,
    });
    expect(r.status(), 'mês 13, dia 45').toBeGreaterThanOrEqual(400);
  });

  test('data de assinatura no futuro não pode fechar o passo 7', async ({ request }) => {
    const pid = await projetoNoPasso(request, 'RN4 Data Futura', 6);
    const tk = await token(request, USUARIOS.administrativo);
    const r = await request.post(`/api/projetos/${pid}/passos/7/concluir`, {
      headers: cab(tk), data: { marcado: true, dataMarcada: '2099-12-31' }, failOnStatusCode: false,
    });
    expect(r.status(), 'assinatura é fato consumado').toBeGreaterThanOrEqual(400);
  });
});

test.describe('Cadastro de usuário — homônimo', () => {
  test('recusa um segundo usuário ativo com o mesmo nome', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.post('/api/usuarios', {
      headers: cab(tk),
      data: {
        login: 'homonimo-e2e', nome: 'Cesar Consultor', email: 'homonimo-e2e@teste.local',
        senha: 'Teste@123', perfil: 'Consultor', codigoSicla: '888',
      },
      failOnStatusCode: false,
    });
    expect(r.status(), 'o nome é a chave de designação do processo').toBe(409);
  });
});

test.describe('Tamanho do corpo da requisição', () => {
  test('corpo acima do limite responde 413, não um 404 dizendo que a rota não existe', async ({ request }) => {
    const tk = await token(request, USUARIOS.adm);
    const r = await request.post('/api/projetos', {
      headers: cab(tk), data: { cliente: 'X', observacoes: 'A'.repeat(200_000) },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(413);
  });
});
