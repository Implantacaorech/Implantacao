import { Test, TestingModule } from '@nestjs/testing';
import { ModificacoesService } from './modificacoes.service';
import { ModificacoesRepository } from './repositories/modificacoes.repository';

describe('ModificacoesService', () => {
  let service: ModificacoesService;
  // Dublê do REPOSITORY — ver a nota equivalente em cronograma-itens.service.spec.ts.
  const repo = { doProjeto: jest.fn(), registrar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModificacoesService,
        { provide: ModificacoesRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(ModificacoesService);
  });

  it('registrar grava com autor vazio quando não informado', async () => {
    await service.registrar(1, 'cronograma', 'linha 1', 'status', 'A', 'B', '');
    expect(repo.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        projetoId: 1,
        entidade: 'cronograma',
        autor: '',
      }),
    );
  });

  it('doProjeto repassa entidade e limite informados', async () => {
    repo.doProjeto.mockResolvedValue([]);
    await service.doProjeto(1, 'checklist', 50);
    expect(repo.doProjeto).toHaveBeenCalledWith(1, 'checklist', 50);
  });

  it('doProjeto sem entidade filtra só por projeto, com o limite padrão de 200', async () => {
    repo.doProjeto.mockResolvedValue([]);
    await service.doProjeto(1);
    expect(repo.doProjeto).toHaveBeenCalledWith(1, undefined, 200);
  });
});
