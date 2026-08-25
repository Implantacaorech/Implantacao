import { test, expect, Page } from '@playwright/test';
import { entrarComSucesso, projetoNoPasso, USUARIOS } from '../apoio/painel';

/**
 * Varredura da AUDITORIA GERAL (skill `auditoria-geral-sistema`).
 *
 * Não testa uma regra específica: percorre o sistema inteiro num navegador real e coleta o
 * que só aparece em runtime — erro de console, requisição falhando, rota que não renderiza,
 * overflow horizontal. É o instrumento das fases 3, 8 e 9 da auditoria.
 *
 * Falha com o RELATÓRIO do que encontrou, não com um "expected true to be false": o valor
 * aqui está em enxergar tudo de uma vez.
 */

/** Rotas ESTÁTICAS do app (extraídas de frontend/src/app/app.routes.ts). As com parâmetro
 * entram depois, com um projeto real. */
const ROTAS_ESTATICAS = [
  '/home',
  '/projetos',
  '/clientes/novo',
  '/projetos/novo',
  '/coordenacao',
  '/coordenacao/capacidade',
  '/atividade',
  '/monitoramento',
  '/protocolos',
  '/protocolos/gravar',
  '/dicionario',
  '/agenda',
  '/rns',
  '/matriz',
  '/matriz-detalhada',
  '/matriz-funcoes',
  '/config/disponibilidade',
  '/config/email',
  '/config/imap',
  '/config/gmail',
  '/config/ia',
  '/cadastros',
  '/config/modelos-email',
  '/config/destinatarios-passo',
  '/config/consultas-bd',
  '/config/api-dados',
  '/bi/implantacao',
  '/bi/implantacao/contratacao',
  '/bi/implantacao/conclusao',
  '/bi/implantacao/utilizacao',
  '/bi/implantacao/alocacao-calendario',
  '/bi/implantacao/alocacao-horas',
  '/bi/implantacao/movimentos',
  '/bi/clientes-siger',
  '/bi/clientes-siger/resumo',
  '/bi/clientes-siger/extrato',
  '/bi/clientes-siger/rns',
  '/bi/clientes-siger/agendas',
  '/ferramentas',
  '/permissoes',
  '/fluxo',
  '/fluxo/confirmar',
  '/perfil',
  '/mapa',
  '/trocar-senha',
  '/legado',
  '/legado/cliente',
  '/usuarios',
];

/** Ruído conhecido que NÃO é defeito do Painel. Manter curto e justificado — cada entrada
 * aqui é uma coisa que a auditoria deixa de enxergar. */
const RUIDO = [
  /favicon\.ico/i,
  // O docservice pode não estar no ar durante a auditoria; é processo separado.
  /127\.0\.0\.1:8001/,
];

const ehRuido = (t: string) => RUIDO.some((r) => r.test(t));

interface Achado {
  rota: string;
  tipo: 'console' | 'http' | 'render' | 'overflow';
  detalhe: string;
}

/** Liga a coleta de erros de console e de respostas HTTP >= 400 numa página. */
function coletar(page: Page, achados: Achado[], rotaAtual: () => string) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (ehRuido(t)) return;
    achados.push({ rota: rotaAtual(), tipo: 'console', detalhe: t.slice(0, 300) });
  });
  page.on('pageerror', (e) => {
    achados.push({ rota: rotaAtual(), tipo: 'console', detalhe: `pageerror: ${e.message.slice(0, 300)}` });
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    const u = r.url();
    if (ehRuido(u)) return;
    achados.push({ rota: rotaAtual(), tipo: 'http', detalhe: `${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}` });
  });
}

/** Abre a rota, espera assentar e confere que renderizou algo de verdade. */
async function visitar(page: Page, rota: string, achados: Achado[]) {
  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);

  const corpo = (await page.locator('body').innerText().catch(() => '')) ?? '';
  if (corpo.trim().length < 15) {
    achados.push({ rota, tipo: 'render', detalhe: `tela praticamente vazia (${corpo.trim().length} chars)` });
  }
  if (/Carregando/i.test(corpo) && corpo.trim().length < 60) {
    achados.push({ rota, tipo: 'render', detalhe: 'presa em "Carregando…"' });
  }
}

function relatorio(achados: Achado[]): string {
  if (achados.length === 0) return '';
  const porRota = new Map<string, Achado[]>();
  for (const a of achados) porRota.set(a.rota, [...(porRota.get(a.rota) ?? []), a]);
  return [...porRota.entries()]
    .map(([rota, as]) => `\n  ${rota}\n${as.map((a) => `    [${a.tipo}] ${a.detalhe}`).join('\n')}`)
    .join('');
}

test.describe('Auditoria — varredura de rotas', () => {
  test('ADM percorre todas as rotas estáticas sem erro de console nem HTTP', async ({ page }) => {
    test.setTimeout(300_000);
    const achados: Achado[] = [];
    let atual = '(login)';
    coletar(page, achados, () => atual);

    await entrarComSucesso(page, USUARIOS.adm);
    for (const rota of ROTAS_ESTATICAS) {
      atual = rota;
      await visitar(page, rota, achados);
    }

    expect(achados, `Achados na varredura como ADM:${relatorio(achados)}\n`).toEqual([]);
  });

  test('rotas de um PROJETO real abrem sem erro', async ({ page, request }) => {
    test.setTimeout(180_000);
    const id = await projetoNoPasso(request, 'Auditoria Varredura', 8);
    const achados: Achado[] = [];
    let atual = '(login)';
    coletar(page, achados, () => atual);

    await entrarComSucesso(page, USUARIOS.adm);
    for (const sufixo of ['', '/dados', '/passos', '/levantamento', '/cronograma', '/checklist', '/agenda', '/email']) {
      atual = `/projetos/${id}${sufixo}`;
      await visitar(page, atual, achados);
    }

    expect(achados, `Achados nas rotas do projeto:${relatorio(achados)}\n`).toEqual([]);
  });

  test('rota inexistente não quebra — cai no fallback do roteador', async ({ page }) => {
    await entrarComSucesso(page, USUARIOS.adm);
    await page.goto('/rota-que-nao-existe-xyz', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    // O app.routes.ts termina com `{ path: '**', redirectTo: '' }` -> volta para a home.
    await expect(page).not.toHaveURL(/rota-que-nao-existe/);
    expect((await page.locator('body').innerText()).length).toBeGreaterThan(20);
  });
});

test.describe('Auditoria — responsividade', () => {
  const VIEWPORTS = [
    { nome: 'notebook', width: 1366, height: 768 },
    { nome: 'tablet', width: 768, height: 1024 },
    { nome: 'mobile', width: 390, height: 844 },
  ];
  // Amostra representativa: uma tela de lista, uma de formulário, uma de BI e o fluxo.
  const AMOSTRA = ['/home', '/projetos', '/clientes/novo', '/bi/implantacao', '/usuarios', '/permissoes'];

  for (const vp of VIEWPORTS) {
    test(`sem overflow horizontal em ${vp.nome} (${vp.width}px)`, async ({ page }) => {
      // Guarda do achado da auditoria de 2026-08-07: o Painel estourava 43px em 390px, em
      // TODAS as telas — era o shell, não o conteúdo. `.topbar-perfil` é `flex: none` e
      // media 183px com nome+login dentro; como não encolhia, empurrava o `.topbar-sair`
      // para fora (começava em x=397 num viewport de 390). Corrigido escondendo o texto do
      // cartão abaixo de 620px, restando o avatar.
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await entrarComSucesso(page, USUARIOS.adm);

      const achados: Achado[] = [];
      for (const rota of AMOSTRA) {
        await page.goto(rota, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(700);
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        // 2px de tolerância: arredondamento de zoom/scrollbar não é defeito de layout.
        if (m.scroll > m.client + 2) {
          achados.push({ rota, tipo: 'overflow', detalhe: `scrollWidth=${m.scroll} > clientWidth=${m.client} (excesso de ${m.scroll - m.client}px)` });
        }
      }
      expect(achados, `Overflow horizontal em ${vp.nome}:${relatorio(achados)}\n`).toEqual([]);
    });
  }
});

test.describe('Auditoria — menu por perfil', () => {
  // O menu é dirigido por PADRAO_PERMISSOES; cada perfil só pode enxergar o que lhe cabe.
  const ESPERADO: Record<string, { ve: string[]; naoVe: string[] }> = {
    comercial: { ve: ['Novo Cliente'], naoVe: ['Usuários', 'Permissões'] },
    consultor: { ve: ['Carteira'], naoVe: ['Usuários', 'Permissões'] },
    levantador: { ve: ['Carteira'], naoVe: ['Usuários', 'Permissões'] },
    administrativo: { ve: ['Carteira'], naoVe: ['Usuários', 'Permissões'] },
    coordenador: { ve: ['Carteira', 'Coordenação'], naoVe: ['Usuários', 'Permissões'] },
    gci: { ve: ['Carteira'], naoVe: ['Usuários', 'Permissões'] },
  };

  for (const [login, { ve, naoVe }] of Object.entries(ESPERADO)) {
    test(`menu do ${login} mostra o que deve e esconde o que não deve`, async ({ page }) => {
      await entrarComSucesso(page, login);
      await page.goto('/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      const menu = await page.locator('body').innerText();
      for (const item of ve) expect(menu, `${login} deveria ver "${item}"`).toContain(item);
      for (const item of naoVe) expect(menu, `${login} NÃO deveria ver "${item}"`).not.toContain(item);
    });
  }
});
