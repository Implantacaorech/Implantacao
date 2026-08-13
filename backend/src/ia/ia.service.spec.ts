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

  // Usa `dicionario` (finalidade NÃO sensível) para os testes de provedor externo: desde a
  // trava de privacidade A1, `protocolos`/`levantamento` só aceitam o provedor `local`.
  it('salva chave por finalidade de forma independente', () => {
    service.salvar('dicionario', {
      provider: 'anthropic',
      apiKey: 'sk-ant-dic',
      modelo: '',
    });
    expect(service.disponivel('dicionario')).toBe(true);
    expect(service.disponivel('protocolos')).toBe(false);
    const st = service.status('dicionario');
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
    service.salvar('dicionario', {
      provider: 'anthropic',
      apiKey: 'sk-ant',
      modelo: '',
    });
    expect(service.disponivel('dicionario')).toBe(true);
    service.salvar('dicionario', { apiKey: '' });
    expect(service.disponivel('dicionario')).toBe(false);
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
    service.salvar('dicionario', {
      provider: 'anthropic',
      apiKey: 'sk-ant',
      modelo: 'claude-opus-4-8',
    });
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'olá do claude' }],
    });
    const texto = await service.completar('dicionario', {
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

  /** O provedor `local` existe por PRIVACIDADE, não por preço: Protocolos e Levantamento leem
   * transcrição de reunião de cliente, e a transcrição do áudio já roda na própria rede de
   * propósito. Mandar o texto para um endpoint gratuito que treina com o que recebe desfaria
   * essa decisão pela porta dos fundos. */
  describe('provedor local (endpoint compatível com a API da OpenAI)', () => {
    function configurarLocal(over: Record<string, string> = {}): void {
      service.salvar('protocolos', {
        provider: 'local',
        apiKey: '',
        modelo: 'qwen2.5:14b',
        baseUrl: 'http://192.168.1.50:11434/v1',
        ...over,
      });
    }

    /** A chave é opcional aqui — Ollama e LM Studio não pedem nenhuma, e exigir uma
     * inventada só para o registro sobreviver seria teatro. Quem identifica o destino é a URL. */
    it('fica ativo SEM chave, com a URL fazendo o papel dela', () => {
      configurarLocal();
      const st = service.status('protocolos');
      expect(st.ativa).toBe(true);
      expect(st.provider).toBe('local');
      expect(st.baseUrl).toBe('http://192.168.1.50:11434/v1');
      expect(service.disponivel('protocolos')).toBe(true);
    });

    it('chama a URL configurada, no formato OpenAI, e sem cabeçalho de autorização', async () => {
      configurarLocal();
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: 'olá do Ollama' } }],
          }),
      } as Response);

      const texto = await service.completar('protocolos', {
        system: 'sys',
        messages: [{ role: 'user', content: 'oi' }],
        maxTokens: 300,
      });

      expect(texto).toBe('olá do Ollama');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url as string).toBe(
        'http://192.168.1.50:11434/v1/chat/completions',
      );
      const headers = (init as RequestInit).headers as Record<string, string>;
      // `Bearer ` vazio faz alguns servidores recusarem com 401 em vez de ignorar.
      expect(headers.Authorization).toBeUndefined();
      const body = JSON.parse((init as RequestInit).body as string) as {
        model: string;
        messages: { role: string }[];
      };
      expect(body.model).toBe('qwen2.5:14b');
      expect(body.messages[0].role).toBe('system');
      fetchMock.mockRestore();
    });

    it('manda a chave quando há um proxy autenticado na frente', async () => {
      configurarLocal({ apiKey: 'token-do-proxy' });
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      } as Response);

      await service.completar('protocolos', {
        system: '',
        messages: [],
        maxTokens: 10,
      });

      const headers = (fetchMock.mock.calls[0][1] as RequestInit)
        .headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer token-do-proxy');
      fetchMock.mockRestore();
    });

    it('barra final na URL não vira caminho duplicado', () => {
      configurarLocal({ baseUrl: 'http://servidor:11434/v1/' });
      expect(service.status('protocolos').baseUrl).toBe(
        'http://servidor:11434/v1',
      );
    });

    /** Recusar na hora de salvar, e não na primeira chamada de IA horas depois. */
    it.each([
      ['texto que não é URL', 'servidor local'],
      ['protocolo não suportado', 'ftp://servidor/v1'],
    ])('recusa %s ao salvar', (_caso, baseUrl) => {
      expect(() =>
        service.salvar('protocolos', {
          provider: 'local',
          apiKey: '',
          modelo: 'qwen2.5:14b',
          baseUrl,
        }),
      ).toThrow();
      expect(service.disponivel('protocolos')).toBe(false);
    });

    /** Não há padrão possível: o nome é o do modelo carregado NAQUELE servidor. Chutar
     * produziria um 404 do Ollama longe daqui. */
    it('exige o nome do modelo', () => {
      expect(() =>
        service.salvar('protocolos', {
          provider: 'local',
          apiKey: '',
          modelo: '',
          baseUrl: 'http://servidor:11434/v1',
        }),
      ).toThrow('modelo');
    });

    it('URL em branco remove a configuração', () => {
      configurarLocal();
      expect(service.disponivel('protocolos')).toBe(true);
      service.salvar('protocolos', { provider: 'local', baseUrl: '' });
      expect(service.disponivel('protocolos')).toBe(false);
    });

    /** Servidor local desligado é o caso comum, e o "fetch failed" cru não diz nada a quem
     * vai consertar. */
    it('servidor fora do ar vira mensagem que diz o endereço', async () => {
      configurarLocal();
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('fetch failed'));

      await expect(
        service.completar('protocolos', {
          system: '',
          messages: [],
          maxTokens: 10,
        }),
      ).rejects.toThrow('http://192.168.1.50:11434/v1');
      fetchMock.mockRestore();
    });
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

  /** Trava de privacidade/LGPD (A1, 2026-08-12): finalidade que lê dado de cliente só pode
   * usar o provedor `local` — o texto não pode sair da rede. */
  describe('trava de privacidade (só provedor local em finalidade sensível)', () => {
    it.each(['protocolos', 'levantamento'] as const)(
      'recusa salvar %s com provedor externo (anthropic)',
      (finalidade) => {
        expect(() =>
          service.salvar(finalidade, {
            provider: 'anthropic',
            apiKey: 'sk-ant',
            modelo: '',
          }),
        ).toThrow(/só pode usar o provedor local/);
        expect(service.disponivel(finalidade)).toBe(false);
      },
    );

    it('recusa salvar protocolos com openrouter', () => {
      expect(() =>
        service.salvar('protocolos', {
          provider: 'openrouter',
          apiKey: 'sk-or',
          modelo: 'openai/gpt-4o-mini',
        }),
      ).toThrow(/só pode usar o provedor local/);
    });

    it('aceita provedor local em finalidade sensível', () => {
      service.salvar('protocolos', {
        provider: 'local',
        apiKey: '',
        modelo: 'qwen2.5:14b',
        baseUrl: 'http://127.0.0.1:11434/v1',
      });
      expect(service.disponivel('protocolos')).toBe(true);
      expect(service.status('protocolos').provider).toBe('local');
    });

    it('limpar a finalidade sensível (chave em branco) continua permitido', () => {
      expect(() => service.salvar('protocolos', { apiKey: '' })).not.toThrow();
    });
  });

  describe('avisosPrivacidade', () => {
    it('vazio quando não há finalidade sensível saindo da rede', () => {
      expect(service.avisosPrivacidade()).toEqual([]);
    });

    it('denuncia o fallback global por variável de ambiente numa finalidade sensível', () => {
      process.env.MIGRACAO_ANTHROPIC_API_KEY = 'sk-ant-env';
      const avisos = service.avisosPrivacidade();
      const proto = avisos.find((a) => a.finalidade === 'protocolos');
      expect(proto).toBeDefined();
      expect(proto?.provider).toBe('anthropic');
      expect(proto?.viaEnv).toBe(true);
    });

    it('não denuncia o dicionário (finalidade NÃO sensível) em provedor externo', () => {
      service.salvar('dicionario', {
        provider: 'openrouter',
        apiKey: 'sk-or',
        modelo: 'x/y',
      });
      expect(
        service.avisosPrivacidade().some((a) => a.finalidade === 'dicionario'),
      ).toBe(false);
    });
  });
});
