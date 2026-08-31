import {
  INSTANCIA_PADRAO,
  Instancia,
  InstanciaService,
  carregarInstancia,
} from './instancia.service';

/** ESTE teste existe por causa de um defeito real (2026-08-26): a primeira versão do serviço
 * lia `perfil` da RAIZ da resposta, mas o backend embrulha tudo no envelope
 * `{success, data, …}` — então `perfil` vinha `undefined`, caía no padrão, e o **Portal API
 * servia o menu inteiro do Painel**.
 *
 * O teste que existia antes não pegou porque mockava o próprio `InstanciaService`: afirmava
 * o template, não a fiação. Aqui a fiação é o que está sob teste. */
describe('carregarInstancia', () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  function respondendo(corpo: unknown, ok = true): void {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(corpo),
    }) as unknown as typeof fetch;
  }

  it('lê o perfil de DENTRO do envelope do backend', async () => {
    respondendo({
      success: true,
      data: {
        perfil: 'portal-api',
        nome: 'Portal API',
        descricao: 'x',
        rotaInicial: '/config/api-dados',
      },
      message: 'ok',
    });
    const i = await carregarInstancia();
    expect(i.perfil).toBe('portal-api');
    expect(i.rotaInicial).toBe('/config/api-dados');
  });

  it('aceita também a resposta CRUA, sem envelope', async () => {
    // Defensivo: o envelope é do interceptor global, e uma rota que não passe por ele não
    // pode transformar o Portal API em Painel.
    respondendo({ perfil: 'portal-api', nome: 'Portal API' });
    expect((await carregarInstancia()).perfil).toBe('portal-api');
  });

  it('perfil desconhecido cai no Painel completo', async () => {
    respondendo({ data: { perfil: 'portal-de-conexoes' } });
    expect((await carregarInstancia()).perfil).toBe('painel');
  });

  it('resposta de erro cai no Painel completo', async () => {
    respondendo({}, false);
    expect(await carregarInstancia()).toEqual(INSTANCIA_PADRAO);
  });

  it('rede fora do ar não impede a aplicação de subir', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    expect(await carregarInstancia()).toEqual(INSTANCIA_PADRAO);
  });
});

describe('InstanciaService', () => {
  it('nasce como Painel e passa a Portal API quando o boot o define', () => {
    const s = new InstanciaService();
    expect(s.portalApi()).toBe(false);

    const portalApi: Instancia = {
      perfil: 'portal-api',
      nome: 'Portal API',
      descricao: '',
      rotaInicial: '/config/api-dados',
    };
    s.definir(portalApi);
    expect(s.portalApi()).toBe(true);
    expect(s.atual().nome).toBe('Portal API');
  });
});
