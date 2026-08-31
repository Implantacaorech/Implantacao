import { NotFoundException } from '@nestjs/common';
import { TokenApiDados } from '../../database/entities/token-api-dados.entity';
import { TokenApiDadosRepository } from './repositories/token-api-dados.repository';
import { TokenApiDadosService } from './token-api-dados.service';

function linha(over: Partial<TokenApiDados> = {}): TokenApiDados {
  return {
    id: 1,
    nome: 'Portal API',
    url: 'http://interno:5110',
    chave: 'rd_ab12cd34ef56_segredo',
    consultas: 'sicla.rns.listar',
    ativo: true,
    observacao: '',
    criadoEm: new Date('2026-08-25T12:00:00Z'),
    ultimoUsoEm: null,
    ultimoErro: null,
    ...over,
  };
}

function montar(atual = linha()) {
  const criar = jest.fn((d: Partial<TokenApiDados>) =>
    Promise.resolve(linha({ ...d, id: 9 })),
  );
  const salvar = jest.fn((t: TokenApiDados) => Promise.resolve(t));
  const repo = {
    listar: jest.fn().mockResolvedValue([atual]),
    ativos: jest.fn().mockResolvedValue([atual]),
    porId: jest.fn().mockResolvedValue(atual),
    criar,
    salvar,
    registrarUso: jest.fn().mockResolvedValue(undefined),
    remover: jest.fn().mockResolvedValue(undefined),
  } as unknown as TokenApiDadosRepository;
  return { servico: new TokenApiDadosService(repo), criar, salvar };
}

describe('TokenApiDadosService', () => {
  it('a chave NUNCA volta na listagem — só o prefixo', async () => {
    const { servico } = montar();
    const [t] = await servico.listar();
    expect(t.prefixo).toBe('ab12cd34ef56');
    expect(JSON.stringify(t)).not.toContain('segredo');
  });

  it('apara a URL colada do navegador', async () => {
    // O erro mais provável é colar `http://host:5110/config/api-dados` da barra de
    // endereços; sem aparar, o consumo vira um 404 incompreensível.
    const { servico, criar } = montar();
    await servico.criar({
      nome: 'x',
      url: 'http://interno:5110/config/api-dados',
      chave: 'rd_a_b',
      consultas: [],
    });
    expect(criar.mock.calls[0][0].url).toBe('http://interno:5110');

    await servico.criar({
      nome: 'x',
      url: 'http://interno:5110/api/dados/v1/',
      chave: 'rd_a_b',
      consultas: [],
    });
    expect(criar.mock.calls[1][0].url).toBe('http://interno:5110');
  });

  it('chave em branco na edição MANTÉM a atual', async () => {
    // A chave nunca volta para a tela; exigir que ela seja redigitada para corrigir um
    // nome faria o Administrador guardar o segredo em outro lugar.
    const { servico, salvar } = montar();
    await servico.atualizar(1, {
      nome: 'Outro nome',
      url: 'http://interno:5110',
      chave: '   ',
      consultas: ['sicla.rns.listar'],
    });
    const salvo = salvar.mock.calls[0][0];
    expect(salvo.chave).toBe('rd_ab12cd34ef56_segredo');
    expect(salvo.nome).toBe('Outro nome');
  });

  it('chave informada substitui a anterior', async () => {
    const { servico, salvar } = montar();
    await servico.atualizar(1, {
      nome: 'x',
      url: 'http://interno:5110',
      chave: 'rd_novo_segredo',
      consultas: [],
    });
    expect(salvar.mock.calls[0][0].chave).toBe('rd_novo_segredo');
  });

  it('id inexistente é 404, não erro genérico', async () => {
    const repo = {
      porId: jest.fn().mockResolvedValue(null),
    } as unknown as TokenApiDadosRepository;
    await expect(
      new TokenApiDadosService(repo).definirAtivo(99, true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registrar uso é best-effort — falha ao gravar não derruba a consulta', async () => {
    const repo = {
      registrarUso: jest.fn().mockRejectedValue(new Error('banco caiu')),
    } as unknown as TokenApiDadosRepository;
    await expect(
      new TokenApiDadosService(repo).registrarUso(1, null),
    ).resolves.toBeUndefined();
  });
});
