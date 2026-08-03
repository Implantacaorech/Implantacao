import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { httpsPainel } from './https';

/** O HTTPS existe por um motivo só: sem contexto seguro o navegador não entrega o
 * microfone, e a gravação de reunião não funciona fora de localhost. Por isso a regra dura
 * testada aqui — configuração pela metade FALHA o boot em vez de subir em HTTP puro sem
 * avisar, que é o modo de a gravação voltar a quebrar sem ninguém entender por quê. */
describe('httpsPainel', () => {
  let pasta: string;
  let arquivo: string;
  const ambiente = { ...process.env };

  beforeAll(() => {
    pasta = mkdtempSync(join(tmpdir(), 'https-painel-'));
    arquivo = join(pasta, 'painel.pfx');
    writeFileSync(arquivo, 'conteudo-falso');
  });

  afterAll(() => rmSync(pasta, { recursive: true, force: true }));

  beforeEach(() => {
    for (const chave of Object.keys(process.env)) {
      if (chave.startsWith('MIGRACAO_HTTPS')) delete process.env[chave];
    }
  });

  afterAll(() => {
    process.env = ambiente;
  });

  it('sem variável nenhuma, não liga HTTPS (comportamento de hoje, intacto)', () => {
    expect(httpsPainel()).toBeNull();
  });

  it('lê o PFX do Windows direto, sem depender de OpenSSL', () => {
    process.env.MIGRACAO_HTTPS_PFX = arquivo;
    process.env.MIGRACAO_HTTPS_PFX_SENHA = 'painel';

    const r = httpsPainel();

    expect(r?.porta).toBe(5443);
    expect(r?.opcoes.passphrase).toBe('painel');
    expect(r?.opcoes.pfx?.toString()).toBe('conteudo-falso');
  });

  it('aceita par PEM quando a CA entrega nesse formato', () => {
    process.env.MIGRACAO_HTTPS_CERT = arquivo;
    process.env.MIGRACAO_HTTPS_KEY = arquivo;
    process.env.MIGRACAO_HTTPS_PORT = '8443';

    const r = httpsPainel();

    expect(r?.porta).toBe(8443);
    expect(r?.opcoes.cert).toBeDefined();
    expect(r?.opcoes.key).toBeDefined();
  });

  it('falha o boot se o arquivo apontado não existir', () => {
    process.env.MIGRACAO_HTTPS_PFX = join(pasta, 'nao-existe.pfx');

    expect(() => httpsPainel()).toThrow(/não existe/);
  });

  it('falha o boot com PEM pela metade (só cert, sem key)', () => {
    process.env.MIGRACAO_HTTPS_CERT = arquivo;

    expect(() => httpsPainel()).toThrow(/andam juntas/);
  });
});
