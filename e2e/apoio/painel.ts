import { expect, Page, APIRequestContext } from '@playwright/test';

/** Senha única dos usuários da instância isolada (ver e2e/README.md). */
export const SENHA = 'Teste@123';

/** Logins criados na instância de teste, um por papel do processo. */
export const USUARIOS = {
  adm: 'adm',
  comercial: 'comercial',
  administrativo: 'administrativo',
  coordenador: 'coordenador',
  gci: 'gci',
  consultor: 'consultor',
  levantador: 'levantador',
} as const;

/** Entra pela TELA de login — é a interface que está sob teste, não a API. */
export async function entrar(page: Page, login: string, senha = SENHA) {
  await page.goto('/login');
  await page.getByRole('textbox').first().fill(login);
  await page.locator('input[type="password"]').fill(senha);
  await page.getByRole('button', { name: /entrar/i }).click();
}

export async function entrarComSucesso(page: Page, login: string) {
  await entrar(page, login);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Token de API, para PREPARAR estado (nunca para exercer o que está sob teste). */
export async function token(request: APIRequestContext, login: string): Promise<string> {
  const r = await request.post('/api/auth/login', { data: { login, senha: SENHA } });
  const j = await r.json();
  return j.accessToken ?? j.data?.accessToken ?? j.token;
}

const desembrulhar = (j: any) => (j && typeof j === 'object' && 'data' in j ? j.data : j);

/** Cria um projeto já posicionado no passo `ate`, para o teste de tela começar onde importa. */
export async function projetoNoPasso(
  request: APIRequestContext,
  cliente: string,
  ate: number,
): Promise<number> {
  const adm = await token(request, USUARIOS.adm);
  const coord = await token(request, USUARIOS.coordenador);
  const cab = (t: string) => ({ Authorization: `Bearer ${t}` });

  const criado = desembrulhar(
    await (await request.post('/api/projetos', {
      headers: cab(coord),
      data: { cliente, cnpj: '11222333000181', modulos: 'FAT,NFE' },
    })).json(),
  );
  const id = criado.id as number;

  await request.put(`/api/projetos/${id}`, { headers: cab(adm), data: { gci: 'Gabriel GCI' } });
  await request.patch(`/api/projetos/${id}/pessoas`, {
    headers: cab(coord), data: { papel: 'levantador', pessoas: ['Lucia Levantadora'] },
  });
  await request.patch(`/api/projetos/${id}/pessoas`, {
    headers: cab(coord), data: { papel: 'consultor', pessoas: ['Cesar Consultor'] },
  });

  const marcacao: Record<number, boolean> = { 7: true, 12: true };
  const redige = [4, 5, 11, 15, 16, 17, 18, 19, 20, 21];
  for (let n = 1; n <= ate; n++) {
    const data: any = {};
    if (marcacao[n]) { data.marcado = true; data.dataMarcada = '2026-08-05'; }
    if (redige.includes(n)) {
      data.email = { para: ['destino@teste.local'], assunto: `Passo ${n}`, corpo: `Corpo ${n}` };
    }
    // ADM de propósito: preparar estado não é o que está sob teste.
    const r = await request.post(`/api/projetos/${id}/passos/${n}/concluir`, {
      headers: cab(adm), data,
    });
    if (!r.ok()) throw new Error(`preparo parou no passo ${n}: ${r.status()} ${await r.text()}`);
    if (n === 11 || n === 19) {
      await request.post(`/api/projetos/${id}/passos/${n}/conferir`, { headers: cab(adm) });
    }
  }
  return id;
}

/** O cartão de um passo na tela, localizado pelo número no círculo + o título. */
export function cartaoDoPasso(page: Page, numero: number, titulo: string) {
  return page.locator('div.painel').filter({ hasText: titulo }).first();
}
