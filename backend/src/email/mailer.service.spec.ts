import { Test, TestingModule } from '@nestjs/testing';
import { rmSync } from 'fs';
import { join } from 'path';
import { MailerService } from './mailer.service';
import { GraphService } from './graph.service';

// Grava em dados/email_test_<JEST_WORKER_ID>/smtp.json (isolado por worker) — mesmo
// padrão de modelo-documento.service.ts:store() e ia.service.ts:arquivoChave(), para
// não colidir com outros specs *.e2e-spec.ts rodando em paralelo (ver lição da corrida
// EBUSY em docs/migracao/03-documento-conversao.md §6).
describe('MailerService', () => {
  let service: MailerService;
  const graph = { configurado: jest.fn(), enviar: jest.fn() };

  const dirTeste = join(
    process.cwd(),
    'dados',
    `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  afterAll(() => {
    rmSync(dirTeste, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Padrão dos testes: Graph desligado — quem for testá-lo liga explicitamente. Sem isso
    // o `mockReturnValue` de um teste vazaria para o seguinte.
    graph.configurado.mockReturnValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: GraphService, useValue: graph }],
    }).compile();
    service = module.get(MailerService);
  });

  it('carregarConfig devolve valores vazios quando não há arquivo nem env', () => {
    const cfg = service.carregarConfig();
    expect(cfg.host).toBe('');
    expect(cfg.port).toBe('587');
  });

  it('salvarConfig persiste e carregarConfig lê de volta', () => {
    service.salvarConfig({
      host: 'smtp.exemplo.com',
      port: '465',
      user: 'u',
      remetente: 'r@x.com',
      senha: 's3nha',
    });
    const cfg = service.carregarConfig();
    expect(cfg.host).toBe('smtp.exemplo.com');
    expect(cfg.senha).toBe('s3nha');
  });

  it('reeditar sem preencher a senha mantém a senha anterior', () => {
    service.salvarConfig({ host: 'a', remetente: 'r@x.com', senha: 'segredo' });
    service.salvarConfig({ host: 'a', remetente: 'r@x.com', senha: '' });
    expect(service.carregarConfig().senha).toBe('segredo');
  });

  describe('configurado', () => {
    it('true se o Microsoft Graph estiver configurado, mesmo sem SMTP', () => {
      graph.configurado.mockReturnValue(true);
      service.salvarConfig({});
      expect(service.configurado()).toBe(true);
    });

    it('true se SMTP tiver host + remetente', () => {
      service.salvarConfig({ host: 'smtp.exemplo.com', remetente: 'r@x.com' });
      expect(service.configurado()).toBe(true);
    });

    it('false sem Graph e sem host/remetente', () => {
      service.salvarConfig({});
      expect(service.configurado()).toBe(false);
    });
  });

  describe('enviar', () => {
    it('usa o Microsoft Graph quando configurado, sem tentar SMTP', async () => {
      graph.configurado.mockReturnValue(true);
      graph.enviar.mockResolvedValue({ ok: true, erro: null });
      // SMTP também configurado: o Graph precisa ganhar mesmo assim.
      service.salvarConfig({ host: 'smtp.exemplo.com', remetente: 'r@x.com' });
      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(true);
      expect(graph.enviar).toHaveBeenCalledWith(
        'dest@x.com',
        'Assunto',
        'Corpo',
        [],
      );
    });

    it('sem nenhum meio configurado, devolve erro amigável', async () => {
      service.salvarConfig({});
      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(false);
      expect(r.erro).toContain('Nenhum meio de envio configurado');
    });
  });
});
