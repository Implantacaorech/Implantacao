import { Test, TestingModule } from '@nestjs/testing';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { GraphService } from './graph.service';

// Mesmo isolamento por worker do MailerService: grava em
// dados/email_test_<JEST_WORKER_ID>/graph.json para não colidir com specs em paralelo.
describe('GraphService', () => {
  let service: GraphService;

  const dirTeste = join(
    process.cwd(),
    'dados',
    `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  const VARS_ENV = [
    'EMAIL_GRAPH_TENANT_ID',
    'EMAIL_GRAPH_CLIENT_ID',
    'EMAIL_GRAPH_CLIENT_SECRET',
    'EMAIL_REMETENTE',
    'MIGRACAO_GRAPH_TENANT_ID',
    'MIGRACAO_GRAPH_CLIENT_ID',
    'MIGRACAO_GRAPH_CLIENT_SECRET',
    'MIGRACAO_EMAIL_REMETENTE',
  ];
  const envOriginal: Record<string, string | undefined> = {};

  const fetchOriginal = global.fetch;

  /** Resposta HTTP mínima que o serviço consome (`status` + `text()`). */
  function resposta(status: number, corpo = ''): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(corpo),
    } as unknown as Response;
  }

  const TOKEN_OK = JSON.stringify({
    access_token: 'tok-123',
    expires_in: 3600,
  });

  function configCompleta(): void {
    service.salvarConfig({
      tenantId: 'tenant-uuid',
      clientId: 'client-uuid',
      clientSecret: 'segredo',
      remetente: 'implantacao@rech.com.br',
    });
  }

  beforeAll(() => {
    for (const v of VARS_ENV) envOriginal[v] = process.env[v];
  });

  afterAll(() => {
    for (const v of VARS_ENV) {
      if (envOriginal[v] === undefined) delete process.env[v];
      else process.env[v] = envOriginal[v];
    }
    global.fetch = fetchOriginal;
    rmSync(dirTeste, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    for (const v of VARS_ENV) delete process.env[v];
    rmSync(dirTeste, { recursive: true, force: true });
    mkdirSync(dirTeste, { recursive: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [GraphService],
    }).compile();
    service = module.get(GraphService);
  });

  describe('configuração', () => {
    it('devolve valores vazios quando não há arquivo nem env', () => {
      const cfg = service.carregarConfig();
      expect(cfg.tenantId).toBe('');
      expect(cfg.remetente).toBe('');
      expect(service.configurado()).toBe(false);
    });

    it('salvarConfig persiste e carregarConfig lê de volta', () => {
      configCompleta();
      const cfg = service.carregarConfig();
      expect(cfg.tenantId).toBe('tenant-uuid');
      expect(cfg.remetente).toBe('implantacao@rech.com.br');
      expect(service.configurado()).toBe(true);
    });

    it('reeditar sem preencher o segredo mantém o anterior', () => {
      configCompleta();
      service.salvarConfig({
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
        clientSecret: '',
        remetente: 'implantacao@rech.com.br',
      });
      expect(service.carregarConfig().clientSecret).toBe('segredo');
    });

    it('remove espaços do segredo colado do portal do Entra', () => {
      service.salvarConfig({ clientSecret: ' abc def \n' });
      expect(service.carregarConfig().clientSecret).toBe('abcdef');
    });

    it('as variáveis de ambiente do TI têm prioridade sobre o arquivo', () => {
      configCompleta();
      process.env.EMAIL_GRAPH_TENANT_ID = 'tenant-do-ambiente';
      process.env.EMAIL_REMETENTE = 'outra@rech.com.br';
      const cfg = service.carregarConfig();
      expect(cfg.tenantId).toBe('tenant-do-ambiente');
      expect(cfg.remetente).toBe('outra@rech.com.br');
      // o que não veio do ambiente continua vindo do arquivo
      expect(cfg.clientId).toBe('client-uuid');
    });

    it('aceita os apelidos MIGRACAO_* do padrão do backend', () => {
      process.env.MIGRACAO_GRAPH_TENANT_ID = 't';
      process.env.MIGRACAO_GRAPH_CLIENT_ID = 'c';
      process.env.MIGRACAO_GRAPH_CLIENT_SECRET = 's';
      process.env.MIGRACAO_EMAIL_REMETENTE = 'r@rech.com.br';
      expect(service.configurado()).toBe(true);
    });
  });

  describe('enviar', () => {
    it('sem configuração, nem chega a bater na Microsoft', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(false);
      expect(r.erro).toContain('Microsoft 365 não configurado');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('pega o token e envia; 202 é sucesso', async () => {
      configCompleta();
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(resposta(200, TOKEN_OK))
        .mockResolvedValueOnce(resposta(202));
      global.fetch = fetchMock;

      const r = await service.enviar(
        'dest@x.com, outro@x.com',
        'Assunto',
        'Corpo',
      );

      expect(r).toEqual({ ok: true, erro: null });
      const [urlEnvio, opcoes] = fetchMock.mock.calls[1] as [
        string,
        { headers: Record<string, string>; body: string },
      ];
      expect(urlEnvio).toBe(
        'https://graph.microsoft.com/v1.0/users/implantacao%40rech.com.br/sendMail',
      );
      expect(opcoes.headers.Authorization).toBe('Bearer tok-123');
      const enviado = JSON.parse(opcoes.body) as {
        message: { toRecipients: { emailAddress: { address: string } }[] };
        saveToSentItems: boolean;
      };
      // string com vários destinos vira uma lista de destinatários do Graph
      expect(
        enviado.message.toRecipients.map((d) => d.emailAddress.address),
      ).toEqual(['dest@x.com', 'outro@x.com']);
      expect(enviado.saveToSentItems).toBe(true);
    });

    it('reaproveita o token entre envios (não pede outro a cada e-mail)', async () => {
      configCompleta();
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(resposta(200, TOKEN_OK))
        .mockResolvedValue(resposta(202));
      global.fetch = fetchMock;

      await service.enviar('a@x.com', 'A', 'corpo');
      await service.enviar('b@x.com', 'B', 'corpo');

      expect(fetchMock).toHaveBeenCalledTimes(3); // 1 token + 2 envios
    });

    it('salvar nova configuração invalida o token em cache', async () => {
      configCompleta();
      // Despacha pela URL: o token pedido DEPOIS da troca de segredo precisa receber uma
      // resposta de token, não a do envio — por isso este teste não usa `mockResolvedValueOnce`
      // em sequência como os demais.
      const fetchMock = jest.fn((url: string) =>
        Promise.resolve(
          url.includes('login.microsoftonline.com')
            ? resposta(200, TOKEN_OK)
            : resposta(202),
        ),
      );
      global.fetch = fetchMock as unknown as typeof fetch;
      const pedidosDeToken = () =>
        fetchMock.mock.calls.filter(([url]) =>
          url.includes('login.microsoftonline.com'),
        ).length;

      await service.enviar('a@x.com', 'A', 'corpo');
      expect(pedidosDeToken()).toBe(1);

      service.salvarConfig({
        tenantId: 'tenant-uuid',
        clientId: 'client-uuid',
        clientSecret: 'segredo-novo',
        remetente: 'implantacao@rech.com.br',
      });
      const r = await service.enviar('b@x.com', 'B', 'corpo');

      expect(r.ok).toBe(true);
      expect(pedidosDeToken()).toBe(2);
    });

    it('segredo expirado vira mensagem que diz o que fazer', async () => {
      configCompleta();
      global.fetch = jest.fn().mockResolvedValue(
        resposta(
          401,
          JSON.stringify({
            error: 'invalid_client',
            error_description: 'AADSTS7000215: Invalid client secret provided.',
          }),
        ),
      );

      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(false);
      expect(r.erro).toContain('EXPIRADO');
    });

    it('403 aponta a restrição de caixa do aplicativo', async () => {
      configCompleta();
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(resposta(200, TOKEN_OK))
        .mockResolvedValueOnce(resposta(403, 'ErrorAccessDenied'));

      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(false);
      expect(r.erro).toContain('ApplicationAccessPolicy');
      expect(r.erro).toContain('implantacao@rech.com.br');
    });

    it('falha de rede explica a liberação de saída na 443', async () => {
      configCompleta();
      const falha: NodeJS.ErrnoException = new Error('getaddrinfo ENOTFOUND');
      falha.code = 'ENOTFOUND';
      global.fetch = jest.fn().mockRejectedValue(falha);

      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo');
      expect(r.ok).toBe(false);
      expect(r.erro).toContain('443');
    });
  });

  describe('anexos', () => {
    it('anexa o arquivo em base64 e ignora caminho inexistente', async () => {
      configCompleta();
      const caminho = join(dirTeste, 'projeto.docx');
      writeFileSync(caminho, 'conteudo-do-documento');
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(resposta(200, TOKEN_OK))
        .mockResolvedValueOnce(resposta(202));
      global.fetch = fetchMock;

      await service.enviar('dest@x.com', 'Assunto', 'Corpo', [
        { caminho, nomeArquivo: 'Projeto.docx' },
        { caminho: join(dirTeste, 'nao-existe.docx') },
      ]);

      const corpo = JSON.parse(
        (fetchMock.mock.calls[1] as [string, { body: string }])[1].body,
      ) as {
        message: {
          attachments: { name: string; contentBytes: string }[];
        };
      };
      expect(corpo.message.attachments).toHaveLength(1);
      expect(corpo.message.attachments[0].name).toBe('Projeto.docx');
      expect(
        Buffer.from(
          corpo.message.attachments[0].contentBytes,
          'base64',
        ).toString(),
      ).toBe('conteudo-do-documento');
    });

    it('acima do limite do Graph, recusa antes de enviar e explica a alternativa', async () => {
      configCompleta();
      const caminho = join(dirTeste, 'grande.bin');
      writeFileSync(caminho, Buffer.alloc(3 * 1024 * 1024));
      const fetchMock = jest.fn();
      global.fetch = fetchMock;

      const r = await service.enviar('dest@x.com', 'Assunto', 'Corpo', [
        { caminho },
      ]);

      expect(r.ok).toBe(false);
      expect(r.erro).toContain('OneDrive');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
