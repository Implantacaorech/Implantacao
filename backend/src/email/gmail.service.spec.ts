import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { rmSync } from 'fs';
import { join } from 'path';
import { GmailService } from './gmail.service';

describe('GmailService', () => {
  let service: GmailService;
  const config = { get: jest.fn().mockReturnValue(undefined) };

  const dirTeste = join(
    process.cwd(),
    'dados',
    `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  afterAll(() => {
    rmSync(dirTeste, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Limpa client/token do teste anterior — cada `it` parte de um estado limpo (o
    // diretório é compartilhado por todos os testes deste arquivo, isolado só por
    // JEST_WORKER_ID entre arquivos/specs diferentes).
    rmSync(dirTeste, { recursive: true, force: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [GmailService, { provide: ConfigService, useValue: config }],
    }).compile();
    service = module.get(GmailService);
  });

  it('temCliente/configurado começam falsos sem arquivos salvos', () => {
    expect(service.temCliente()).toBe(false);
    expect(service.configurado()).toBe(false);
  });

  it('salvarCliente grava o arquivo e temCliente passa a true', () => {
    const json = JSON.stringify({
      web: {
        client_id: 'id123',
        client_secret: 'segredo',
        redirect_uris: ['http://localhost/callback'],
      },
    });
    service.salvarCliente(Buffer.from(json, 'utf8'));
    expect(service.temCliente()).toBe(true);
  });

  it('urlAutorizacao devolve null sem client salvo', () => {
    expect(service.urlAutorizacao()).toBeNull();
  });

  it('urlAutorizacao devolve uma URL do Google com o scope de envio, depois de salvar o client', () => {
    const json = JSON.stringify({
      web: {
        client_id: 'id123',
        client_secret: 'segredo',
        redirect_uris: ['http://localhost/callback'],
      },
    });
    service.salvarCliente(Buffer.from(json, 'utf8'));
    const url = service.urlAutorizacao();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('gmail.send');
  });

  it('trocarCodigoPorToken rejeita state divergente/ausente (proteção CSRF)', async () => {
    const json = JSON.stringify({
      web: {
        client_id: 'id123',
        client_secret: 'segredo',
        redirect_uris: ['http://localhost/callback'],
      },
    });
    service.salvarCliente(Buffer.from(json, 'utf8'));
    service.urlAutorizacao(); // gera o estado pendente
    const r = await service.trocarCodigoPorToken('algum-code', 'state-errado');
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('inválida ou expirada');
  });

  it('trocarCodigoPorToken sem client configurado devolve erro claro', async () => {
    const r = await service.trocarCodigoPorToken('code', 'state');
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('inválida ou expirada'); // sem urlAutorizacao() prévia, não há estado pendente
  });

  it('enviar sem token configurado devolve erro "não autorizado"', async () => {
    const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
    expect(r.ok).toBe(false);
    expect(r.erro).toContain('não autorizado');
  });
});
