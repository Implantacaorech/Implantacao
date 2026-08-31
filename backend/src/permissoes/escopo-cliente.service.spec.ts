import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import {
  ESCOPO_INTERNO,
  EscopoCliente,
  EscopoClienteService,
  linhaVisivel,
  separarCodigos,
} from './escopo-cliente.service';

const usuario = (over: Record<string, unknown> = {}) =>
  ({
    id: 5,
    login: 'quem',
    nome: 'Quem',
    email: 'quem@x.com',
    senhaHash: '',
    perfil: 'Consultor',
    perfis: '',
    codigoSicla: '007',
    codigoClienteSicla: '',
    modulosCapacitados: '',
    setorAtuacao: '',
    ativo: true,
    criadoEm: new Date(),
    ...over,
  }) as never;

describe('EscopoClienteService', () => {
  let service: EscopoClienteService;
  const users = { buscarPorId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        EscopoClienteService,
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = modulo.get(EscopoClienteService);
  });

  it('papel interno vê tudo', async () => {
    users.buscarPorId.mockResolvedValue(usuario({ perfil: 'GCI' }));
    await expect(service.escopoDe({ sub: 5, perfil: 'GCI' })).resolves.toEqual({
      interno: true,
    });
  });

  it('usuário-cliente com vínculo recebe os códigos dele', async () => {
    users.buscarPorId.mockResolvedValue(
      usuario({ perfil: 'Cliente', codigoClienteSicla: '4321' }),
    );
    await expect(
      service.escopoDe({ sub: 5, perfil: 'Cliente' }),
    ).resolves.toEqual({ interno: false, codigos: ['4321'] });
  });

  // A regra central do desenho: sem vínculo é 403, JAMAIS "sem filtro". Um cadastro
  // incompleto não pode virar a carteira inteira da Rech numa tela de cliente.
  it('usuário-cliente SEM vínculo é recusado, não liberado', async () => {
    users.buscarPorId.mockResolvedValue(
      usuario({ perfil: 'Cliente', codigoClienteSicla: '   ' }),
    );
    await expect(
      service.escopoDe({ sub: 5, perfil: 'Cliente' }),
    ).rejects.toThrow(ForbiddenException);
  });

  // O papel vem do BANCO, não do token: é o que faz a revogação valer na hora, em vez de
  // só no próximo refresh.
  it('lê o papel do banco, ignorando o que o token afirma', async () => {
    users.buscarPorId.mockResolvedValue(
      usuario({ perfil: 'Cliente', codigoClienteSicla: '99' }),
    );
    // O token ainda diz "Consultor" (foi emitido antes da troca de papel).
    await expect(
      service.escopoDe({ sub: 5, perfil: 'Consultor' }),
    ).resolves.toEqual({ interno: false, codigos: ['99'] });
  });

  it('usuário desativado não recebe escopo nenhum', async () => {
    users.buscarPorId.mockResolvedValue(usuario({ ativo: false }));
    await expect(
      service.escopoDe({ sub: 5, perfil: 'Consultor' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('usuário apagado não recebe escopo nenhum', async () => {
    users.buscarPorId.mockRejectedValue(new Error('não existe'));
    await expect(
      service.escopoDe({ sub: 5, perfil: 'Consultor' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sessão sem usuário é recusada', async () => {
    await expect(service.escopoDe(undefined)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('separarCodigos', () => {
  it('aceita um código só', () => {
    expect(separarCodigos('4321')).toEqual(['4321']);
  });

  it('aceita lista, aparando e sem repetir', () => {
    expect(separarCodigos(' 1, 2 ,,1 , 3 ')).toEqual(['1', '2', '3']);
  });

  it('vazio/nulo não vira código nenhum', () => {
    expect(separarCodigos('')).toEqual([]);
    expect(separarCodigos(null)).toEqual([]);
    expect(separarCodigos(undefined)).toEqual([]);
    expect(separarCodigos('  ,  ')).toEqual([]);
  });
});

describe('linhaVisivel', () => {
  const cliente: EscopoCliente = { interno: false, codigos: ['10', '20'] };

  it('interno enxerga qualquer linha, inclusive sem código', () => {
    expect(linhaVisivel(ESCOPO_INTERNO, 999)).toBe(true);
    expect(linhaVisivel(ESCOPO_INTERNO, null)).toBe(true);
  });

  it('cliente enxerga os códigos dele', () => {
    expect(linhaVisivel(cliente, 10)).toBe(true);
    expect(linhaVisivel(cliente, '20')).toBe(true);
  });

  it('cliente NÃO enxerga o código de outro', () => {
    expect(linhaVisivel(cliente, 11)).toBe(false);
    expect(linhaVisivel(cliente, 2)).toBe(false); // nem por prefixo/substring
  });

  // Uma das origens do BI (`portal.visitas.listar`) é SQL editável em Sistema → Consultas
  // BD. Se alguém derrubar a coluna do código, a linha chega sem identificação — e o certo
  // é a tela do cliente esvaziar, não virar um dump de todos os clientes.
  it('linha sem código identificável não passa para o cliente', () => {
    expect(linhaVisivel(cliente, null)).toBe(false);
    expect(linhaVisivel(cliente, undefined)).toBe(false);
    expect(linhaVisivel(cliente, '')).toBe(false);
    expect(linhaVisivel(cliente, '   ')).toBe(false);
  });
});
