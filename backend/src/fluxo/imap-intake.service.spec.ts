import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { rmSync } from 'fs';
import { join } from 'path';
import { ImapIntakeService } from './imap-intake.service';

// Simula o cliente real do imapflow (EventEmitter) para provar que um evento 'error'
// assíncrono no socket (achado real: ETIMEOUT derrubando o processo Node inteiro em
// produção, ver imap-intake.service.ts:conectar) não escapa como exceção não tratada.
class ImapFlowFalsoComErro extends EventEmitter {
  async connect(): Promise<void> {
    setImmediate(() =>
      this.emit(
        'error',
        Object.assign(new Error('Socket timeout'), { code: 'ETIMEOUT' }),
      ),
    );
  }
  async getMailboxLock(): Promise<{ release: () => void }> {
    return { release: () => {} };
  }
  async search(): Promise<number[]> {
    return [];
  }
  async logout(): Promise<void> {}
}

/** Reproduz a recusa de credencial do Gmail: o imapflow rejeita com a PROPRIEDADE
 * `authenticationFailed` e a mensagem genérica "Command failed" — foi por isso que a
 * detecção por texto não pegava o caso mais comum. */
class ImapFlowFalsoAuthRecusada extends EventEmitter {
  connect(): Promise<void> {
    return Promise.reject(
      Object.assign(new Error('Command failed'), {
        authenticationFailed: true,
        responseStatus: 'NO',
      }),
    );
  }
  async logout(): Promise<void> {}
}

let clienteFalso: () => EventEmitter = () => new ImapFlowFalsoComErro();

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => clienteFalso()),
}));

describe('ImapIntakeService', () => {
  let service: ImapIntakeService;

  const dirTeste = join(
    process.cwd(),
    'dados',
    `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  afterAll(() => {
    rmSync(dirTeste, { recursive: true, force: true });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImapIntakeService],
    }).compile();
    service = module.get(ImapIntakeService);
  });

  it('carregarConfig devolve porta padrão 993 e pasta INBOX quando vazio', () => {
    const cfg = service.carregarConfig();
    expect(cfg.port).toBe('993');
    expect(cfg.pasta).toBe('INBOX');
  });

  it('salvarConfig persiste e carregarConfig lê de volta', () => {
    service.salvarConfig({
      host: 'imap.exemplo.com',
      user: 'u',
      pasta: 'Fechamentos',
      senha: 's3nha',
    });
    const cfg = service.carregarConfig();
    expect(cfg.host).toBe('imap.exemplo.com');
    expect(cfg.pasta).toBe('Fechamentos');
    expect(cfg.senha).toBe('s3nha');
  });

  it('reeditar sem preencher a senha mantém a senha anterior', () => {
    service.salvarConfig({ host: 'a', user: 'u', senha: 'segredo' });
    service.salvarConfig({ host: 'a', user: 'u', senha: '' });
    expect(service.carregarConfig().senha).toBe('segredo');
  });

  describe('configurado', () => {
    it('true só com host + user', () => {
      service.salvarConfig({ host: 'imap.exemplo.com', user: 'u' });
      expect(service.configurado()).toBe(true);
    });

    it('false sem host', () => {
      service.salvarConfig({ host: '', user: 'u' });
      expect(service.configurado()).toBe(false);
    });
  });

  describe('processarFechamentos / buscarFechamento sem config', () => {
    it('processarFechamentos devolve 0 sem host configurado', async () => {
      service.salvarConfig({ host: '' });
      const n = await service.processarFechamentos(async () => {});
      expect(n).toBe(0);
    });

    it('buscarFechamento devolve erro amigável sem host configurado', async () => {
      service.salvarConfig({ host: '' });
      const r = await service.buscarFechamento();
      expect(r.corpo).toBeNull();
      expect(r.erro).toContain('IMAP não configurado');
    });
  });

  describe('credencial recusada pelo servidor (achado real em produção)', () => {
    beforeEach(() => {
      clienteFalso = () => new ImapFlowFalsoAuthRecusada();
    });
    afterEach(() => {
      clienteFalso = () => new ImapFlowFalsoComErro();
    });

    it('NÃO engole a falha: registra o motivo em vez de devolver 0 em silêncio', async () => {
      // Antes, `catch { return n; }` fazia o robô devolver "0 processados" para sempre,
      // sem log e sem nada na tela — para quem usa, o Painel só "não lia e-mail".
      service.salvarConfig({
        host: 'imap.gmail.com',
        user: 'u@x.com',
        senha: 'abcd',
      });
      const n = await service.processarFechamentos(async () => {});
      expect(n).toBe(0);
      const erro = service.ultimoErroLeitura();
      expect(erro).not.toBeNull();
      expect(erro?.mensagem).toContain('SENHA DE APP');
    });

    it('reconhece a recusa pela PROPRIEDADE, não pelo texto da mensagem', async () => {
      // A mensagem do imapflow é só "Command failed"; a detecção antiga procurava
      // "authenticate"/"login" no texto e caía no erro genérico.
      service.salvarConfig({
        host: 'imap.gmail.com',
        user: 'u@x.com',
        senha: 'abcd',
      });
      await service.processarFechamentos(async () => {});
      const msg = service.ultimoErroLeitura()?.mensagem ?? '';
      expect(msg).not.toContain('Command failed');
      expect(msg).toContain('recusados');
    });
  });

  describe('erro assíncrono de socket (ImapFlow EventEmitter)', () => {
    it('um evento "error" emitido pelo cliente IMAP não derruba a chamada (crash real corrigido)', async () => {
      service.salvarConfig({ host: 'imap.exemplo.com', user: 'u', senha: 's' });
      // Antes da correção, o 'error' emitido por ImapFlowFalsoComErro (sem listener)
      // vira uma exceção não tratada do processo Node — o teste falharia com o processo
      // inteiro abortando, não com uma rejeição de promise comum.
      await expect(service.buscarFechamento()).resolves.toBeDefined();
    });
  });
});
