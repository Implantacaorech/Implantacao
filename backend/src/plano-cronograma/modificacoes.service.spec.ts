import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModificacoesService } from './modificacoes.service';
import { Modificacao } from '../database/entities/modificacao.entity';

describe('ModificacoesService', () => {
  let service: ModificacoesService;
  const repo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModificacoesService,
        { provide: getRepositoryToken(Modificacao), useValue: repo },
      ],
    }).compile();
    service = module.get(ModificacoesService);
  });

  it('registrar grava com autor vazio quando não informado', async () => {
    await service.registrar(1, 'cronograma', 'linha 1', 'status', 'A', 'B', '');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        projetoId: 1,
        entidade: 'cronograma',
        autor: '',
      }),
    );
  });

  it('doProjeto filtra por entidade quando informada e respeita o limite', async () => {
    repo.find.mockResolvedValue([]);
    await service.doProjeto(1, 'checklist', 50);
    expect(repo.find).toHaveBeenCalledWith({
      where: { projetoId: 1, entidade: 'checklist' },
      order: { criadoEm: 'DESC' },
      take: 50,
    });
  });

  it('doProjeto sem entidade filtra só por projeto', async () => {
    repo.find.mockResolvedValue([]);
    await service.doProjeto(1);
    expect(repo.find).toHaveBeenCalledWith({
      where: { projetoId: 1 },
      order: { criadoEm: 'DESC' },
      take: 200,
    });
  });
});
