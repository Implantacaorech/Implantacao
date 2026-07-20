import { IaService } from './ia.service';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const createMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  }));
});

function limparConfig(): void {
  const worker = process.env.JEST_WORKER_ID ?? '0';
  for (const nome of [
    `ia_config_test_${worker}.json`,
    `anthropic_key_test_${worker}.txt`,
  ]) {
    const p = join(process.cwd(), 'dados', nome);
    if (existsSync(p)) rmSync(p);
  }
}

describe('IaService', () => {
  let service: IaService;
  const envAntigo = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MIGRACAO_ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MIGRACAO_ANTHROPIC_MODELO;
    limparConfig();
    service = new IaService();
  });

  afterEach(() => {
    limparConfig();
    process.env = { ...envAntigo };
  });

  it('sem nenhuma configuração, todas as finalidades ficam inativas', () => {
    expect(service.disponivel('protocolos')).toBe(false);
    expect(service.disponivel('dicionario')).toBe(false);
    expect(service.statusTodas().every((s) => !s.ativa)).toBe(true);
  });

  it('salva chave por finalidade de forma independente', () => {
    service.salvar('protocolos', {
      provider: 'anthropic',
      apiKey: 'sk-ant-proto',
      modelo: '',
    });
    expect(service.disponivel('protocolos')).toBe(true);
    expect(service.disponivel('dicionario')).toBe(false);
    const st = service.status('protocolos');
    expect(st.provider).toBe('anthropic');
    expect(st.modelo).toBe('claude-opus-4-8'); // default aplicado
  });

  it('aceita provedor openrouter com modelo próprio', () => {
    service.salvar('dicionario', {
      provider: 'openrouter',
      apiKey: 'sk-or-xyz',
      modelo: 'anthropic/claude-sonnet-4',
    });
    const st = service.status('dicionario');
    expect(st.ativa).toBe(true);
    expect(st.provider).toBe('openrouter');
    expect(st.modelo).toBe('anthropic/claude-sonnet-4');
  });

  it('chave vazia remove a configuração da finalidade', () => {
    service.salvar('protocolos', {
      provider: 'anthropic',
      apiKey: 'sk-ant',
      modelo: '',
    });
    expect(service.disponivel('protocolos')).toBe(true);
    service.salvar('protocolos', { apiKey: '' });
    expect(service.disponivel('protocolos')).toBe(false);
  });

  it('env var Anthropic é fallback global (viaEnv) para finalidades sem config própria', () => {
    process.env.MIGRACAO_ANTHROPIC_API_KEY = 'sk-ant-env';
    const st = service.status('protocolos');
    expect(st.ativa).toBe(true);
    expect(st.viaEnv).toBe(true);
    // config própria de outra finalidade tem prioridade e não é viaEnv
    service.salvar('dicionario', {
      provider: 'openrouter',
      apiKey: 'sk-or',
      modelo: 'x/y',
    });
    const stDic = service.status('dicionario');
    expect(stDic.viaEnv).toBe(false);
    expect(stDic.provider).toBe('openrouter');
  });

  it('completar despacha para o Anthropic SDK quando o provedor é anthropic', async () => {
    service.salvar('protocolos', {
      provider: 'anthropic',
      apiKey: 'sk-ant',
      modelo: 'claude-opus-4-8',
    });
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'olá do claude' }],
    });
    const texto = await service.completar('protocolos', {
      system: 'sys',
      messages: [{ role: 'user', content: 'oi' }],
      maxTokens: 100,
    });
    expect(texto).toBe('olá do claude');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-8',
        max_tokens: 100,
        system: 'sys',
      }),
    );
  });

  it('completar despacha para o OpenRouter (fetch, formato OpenAI) quando o provedor é openrouter', async () => {
    service.salvar('dicionario', {
      provider: 'openrouter',
      apiKey: 'sk-or',
      modelo: 'anthropic/claude-sonnet-4',
    });
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'olá do openrouter' } }],
        }),
    } as Response);

    const texto = await service.completar('dicionario', {
      system: 'sys',
      messages: [{ role: 'user', content: 'oi' }],
      maxTokens: 200,
    });

    expect(texto).toBe('olá do openrouter');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url as string).toContain('openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe('anthropic/claude-sonnet-4');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    fetchMock.mockRestore();
  });

  it('completar lança quando a finalidade não está configurada', async () => {
    await expect(
      service.completar('protocolos', {
        system: '',
        messages: [],
        maxTokens: 10,
      }),
    ).rejects.toThrow('IA não configurada');
  });

  it('openrouter sem modelo informado falha com mensagem clara', async () => {
    service.salvar('dicionario', {
      provider: 'openrouter',
      apiKey: 'sk-or',
      modelo: '',
    });
    await expect(
      service.completar('dicionario', {
        system: '',
        messages: [],
        maxTokens: 10,
      }),
    ).rejects.toThrow('Modelo do OpenRouter não informado');
  });

  it('listarModelosOpenRouter devolve o catálogo ordenado por id', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { id: 'openai/gpt-4o', name: 'GPT-4o' },
            { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
          ],
        }),
    } as Response);
    const modelos = await service.listarModelosOpenRouter();
    expect(modelos.map((m) => m.id)).toEqual([
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
    ]);
    fetchMock.mockRestore();
  });

  it('listarModelosOpenRouter falha graciosamente (lista vazia) se a rede cair', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new Error('rede caiu'));
    expect(await service.listarModelosOpenRouter()).toEqual([]);
    fetchMock.mockRestore();
  });
});
