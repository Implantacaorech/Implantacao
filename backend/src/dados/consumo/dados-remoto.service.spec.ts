import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { TokenApiDados } from '../../database/entities/token-api-dados.entity';
import { DadosRemotoService, problemaNoToken } from './dados-remoto.service';
import { TokenApiDadosService } from './token-api-dados.service';

function token(over: Partial<TokenApiDados> = {}): TokenApiDados {
  return {
    id: 1,
    nome: 'Portal API interno',
    url: 'http://interno:5110',
    chave: 'rd_ab12cd34ef56_segredo',
    consultas: 'sicla.rns.listar,sicla.agenda.listar',
    ativo: true,
    observacao: '',
    criadoEm: new Date('2026-08-25T12:00:00Z'),
    ultimoUsoEm: null,
    ultimoErro: null,
    ...over,
  };
}

/** Token bem formado, como o Portal API o emite. Vários testes de `sondar` usavam um
 * `rd_a_b` de fantasia; desde que o formato é conferido antes da rede, ele é recusado ali —
 * corretamente. */
const TOKEN_OK = `rd_${'a'.repeat(12)}_${'b'.repeat(48)}`;

function resposta(
  linhas: Record<string, unknown>[],
  temMais = false,
  colunas = ['A'],
) {
  return of({ data: { data: { colunas, linhas, paginacao: { temMais } } } });
}

function montar(tokens: TokenApiDados[]) {
  const registrarUso = jest.fn().mockResolvedValue(undefined);
  const cadastro = {
    ativos: jest.fn().mockResolvedValue(tokens),
    registrarUso,
  } as unknown as TokenApiDadosService;
  const post = jest.fn();
  const get = jest.fn();
  const http = { post, get } as unknown as HttpService;
  return {
    servico: new DadosRemotoService(cadastro, http),
    post,
    get,
    registrarUso,
  };
}

/** O consumo remoto é o que fecha o desenho das duas instâncias. O que estes testes
 * protegem é o que o desenho promete: ele só assume o caminho quando há token que cubra a
 * consulta, ele traz o resultado INTEIRO (não a primeira página), e quando falha diz o que
 * o Administrador precisa fazer — não um número de status. */
describe('DadosRemotoService', () => {
  it('sem token cadastrado, o consumo remoto fica inativo', async () => {
    const { servico } = montar([]);
    expect(await servico.ativo()).toBe(false);
    expect(await servico.cobre('sicla.rns.listar')).toBe(false);
  });

  it('ignora token sem URL ou sem chave — cadastro pela metade não vira caminho', async () => {
    const { servico } = montar([token({ url: '  ' })]);
    expect(await servico.ativo()).toBe(false);
  });

  it('só cobre as consultas que o token autoriza', async () => {
    const { servico } = montar([token()]);
    expect(await servico.cobre('sicla.rns.listar')).toBe(true);
    // Mesma conexão, consulta diferente: continua indo pelo caminho local.
    expect(await servico.cobre('sicla.bi.extrato-horas')).toBe(false);
  });

  it('manda a chave no cabeçalho e os PARÂMETROS, nunca SQL', async () => {
    const { servico, post } = montar([token()]);
    post.mockReturnValue(resposta([{ A: 1 }]));

    await servico.consultar('sicla.rns.listar', { data_ini: '2026-08-01' });

    const [url, corpo, opcoes] = post.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      'http://interno:5110/api/dados/v1/consultas/sicla.rns.listar/executar',
    );
    expect(corpo.parametros).toEqual({ data_ini: '2026-08-01' });
    expect(JSON.stringify(corpo)).not.toMatch(/select/i);
    expect(opcoes.headers['X-API-Key']).toBe('rd_ab12cd34ef56_segredo');
  });

  it('pagina até o fim — o resultado volta INTEIRO', async () => {
    // O Portal API pagina em 5000; consulta de teto maior precisa de mais de uma volta.
    // Parar na primeira página truncaria em silêncio, que é o defeito clássico daqui.
    const { servico, post } = montar([token()]);
    post
      .mockReturnValueOnce(resposta([{ A: 1 }, { A: 2 }], true))
      .mockReturnValueOnce(resposta([{ A: 3 }], false));

    const r = await servico.consultar('sicla.rns.listar', {});
    expect(r.ok).toBe(true);
    expect(r.linhas).toHaveLength(3);
    expect(r.colunas).toEqual(['A']);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('consulta que token nenhum cobre devolve erro que diz onde resolver', async () => {
    const { servico, post } = montar([token()]);
    const r = await servico.consultar('sicla.bi.extrato-horas', {});
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('Portal API');
    expect(post).not.toHaveBeenCalled();
  });

  it('401 vira "o token foi revogado", não "401"', async () => {
    const { servico, post, registrarUso } = montar([token()]);
    post.mockReturnValue(throwError(() => ({ response: { status: 401 } })));

    const r = await servico.consultar('sicla.rns.listar', {});
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/revogado|rotacionado/);
    // A falha fica gravada no token: é o que responde "por que a tela ficou vazia?".
    expect(registrarUso).toHaveBeenCalledWith(
      1,
      expect.stringMatching(/revogado/),
    );
  });

  it('instância fora do ar diz o endereço que não respondeu', async () => {
    const { servico, post } = montar([token()]);
    post.mockReturnValue(throwError(() => ({ message: 'ECONNREFUSED' })));

    const r = await servico.consultar('sicla.rns.listar', {});
    expect(r.mensagem).toContain('http://interno:5110');
    expect(r.mensagem).toContain('ECONNREFUSED');
  });

  it('sondar devolve as consultas que o token enxerga — sem ninguém digitar nome', async () => {
    const { servico, get } = montar([]);
    get.mockReturnValue(
      of({
        data: {
          data: {
            consultas: [{ nome: 'sicla.rns.listar' }, { nome: 'x.y.z' }],
          },
        },
      }),
    );

    const r = await servico.sondar('http://interno:5110/', TOKEN_OK);
    expect(r.ok).toBe(true);
    expect(r.consultas).toEqual(['sicla.rns.listar', 'x.y.z']);
    const [url] = get.mock.calls[0] as [string];
    expect(url).toBe('http://interno:5110/api/dados/v1/consultas');
  });

  it('sondar avisa quando o token é válido mas não autoriza nada', async () => {
    const { servico, get } = montar([]);
    get.mockReturnValue(of({ data: { data: { consultas: [] } } }));
    const r = await servico.sondar('http://interno:5110', TOKEN_OK);
    expect(r.ok).toBe(true);
    expect(r.mensagem).toContain('não autoriza');
  });

  it('sondar sem URL ou sem chave nem chama o Portal API', async () => {
    const { servico, get } = montar([]);
    const r = await servico.sondar('', TOKEN_OK);
    expect(r.ok).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it('sondar recusa token MALFORMADO antes de ir à rede', async () => {
    const { servico, get } = montar([]);
    const r = await servico.sondar('http://interno:5110', 'rd_abc_def');
    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain('INCOMPLETO');
    expect(get).not.toHaveBeenCalled();
  });

  it('sondar apara a URL colada da barra do navegador', async () => {
    const { servico, get } = montar([]);
    get.mockReturnValue(of({ data: { data: { consultas: [] } } }));
    await servico.sondar('http://interno:5110/config/api-dados', TOKEN_OK);
    expect((get.mock.calls[0] as [string])[0]).toBe(
      'http://interno:5110/api/dados/v1/consultas',
    );
  });

  it('401 NÃO afirma que o token foi revogado — lista as possibilidades', async () => {
    const { servico, post } = montar([token()]);
    post.mockReturnValue(throwError(() => ({ response: { status: 401 } })));
    const r = await servico.consultar('sicla.rns.listar', {});
    expect(r.mensagem).toContain('copiado incompleto');
    expect(r.mensagem).toContain('revogado');
    expect(r.mensagem).toContain('outra instância');
  });

  it('banco fora do ar não derruba o Painel — só desliga o consumo remoto', async () => {
    // Estado real antes de a migration rodar: a tabela não existe.
    const cadastro = {
      ativos: jest.fn().mockRejectedValue(new Error('no such table')),
      registrarUso: jest.fn(),
    } as unknown as TokenApiDadosService;
    const servico = new DadosRemotoService(cadastro, {
      post: jest.fn(),
      get: jest.fn(),
    } as unknown as HttpService);

    expect(await servico.ativo()).toBe(false);
  });
});

/** Diagnóstico do texto colado. Nasceu de um caso real (2026-08-26): o token foi copiado
 * pela metade, o Portal API devolveu 401 e a mensagem AFIRMAVA "foi revogado ou rotacionado"
 * — mandando procurar no lugar errado. Conferir o formato antes de enviar é o que permite
 * dizer a verdade. */
describe('problemaNoToken', () => {
  const VALIDO = TOKEN_OK;

  it('aceita o formato que o Portal API emite', () => {
    expect(problemaNoToken(VALIDO)).toBeNull();
    // Espaço em volta é da colagem, não do token.
    expect(
      problemaNoToken(`  ${VALIDO}
`),
    ).toBeNull();
  });

  it('token cortado ao meio diz que está INCOMPLETO, com os tamanhos', () => {
    const m = problemaNoToken(VALIDO.slice(0, 40));
    expect(m).toContain('INCOMPLETO');
    expect(m).toContain('esperado 48');
  });

  it('texto com espaço no meio (colou o rótulo junto) é apontado', () => {
    expect(problemaNoToken(`TOKEN ${VALIDO}`)).toContain('espaço');
  });

  it('outra coisa qualquer não vira "revogado"', () => {
    expect(problemaNoToken('minha-senha')).toContain('rd_');
  });

  it('vazio pede o token', () => {
    expect(problemaNoToken('   ')).toContain('Cole o token');
  });
});
