import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { Projeto } from '../database/entities/projeto.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';

describe('ProjetosService', () => {
  let service: ProjetosService;

  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjetosService,
        { provide: getRepositoryToken(Projeto), useValue: repo },
      ],
    }).compile();
    service = module.get(ProjetosService);
  });

  function user(perfil: AuthUser['perfil'], nome = 'Fulano'): AuthUser {
    return { sub: 1, login: 'x', nome, perfil, codigoSicla: '' };
  }

  it('ADM/gestão vê tudo — não aplica filtro por nome', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('ADM'));
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('p.gci'),
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('p.consultor'),
      expect.anything(),
    );
  });

  it('GCI só vê onde é GCI (_so_meus)', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('GCI', 'Ana'));
    expect(qb.andWhere).toHaveBeenCalledWith('p.gci = :nome', { nome: 'Ana' });
  });

  it('Consultor só vê onde é consultor designado (_so_meus)', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('Consultor', 'Beto'));
    expect(qb.andWhere).toHaveBeenCalledWith('p.consultor = :nome', {
      nome: 'Beto',
    });
  });

  it('calcula paginação corretamente', async () => {
    qb.getCount.mockResolvedValue(45);
    qb.getMany.mockResolvedValue([]);
    const res = await service.listar({ page: 2, limit: 20 }, user('ADM'));
    expect(res.pagination).toEqual({
      page: 2,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
    });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('buscarPorId lança NotFoundException quando não existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.buscarPorId(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('atualizar mescla os campos enviados sem apagar os demais', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      cliente: 'Antigo',
      situacao: 'Em andamento',
    });
    const atualizado = await service.atualizar(1, { situacao: 'Em risco' });
    expect(atualizado).toMatchObject({
      cliente: 'Antigo',
      situacao: 'Em risco',
    });
  });
});
