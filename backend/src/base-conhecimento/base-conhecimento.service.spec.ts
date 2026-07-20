import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BaseConhecimentoService } from './base-conhecimento.service';
import { SigerFonte } from '../database/entities/siger-fonte.entity';

describe('BaseConhecimentoService', () => {
  let service: BaseConhecimentoService;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    getRawOne: jest.fn(),
  };

  const repo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.orWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    queryBuilder.select.mockReturnThis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseConhecimentoService,
        { provide: getRepositoryToken(SigerFonte), useValue: repo },
      ],
    }).compile();
    service = module.get(BaseConhecimentoService);
  });

  it('pesquisar busca por caminho ou conteúdo e recorta um trecho em torno do termo', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 1,
        caminho: 'CRIAFONTES_MTZ/22.20c/AUE031.CBL',
        extensao: '.cbl',
        pastaRaiz: 'CRIAFONTES_MTZ',
        tamanhoBytes: 1000,
        modificadoEm: new Date('2026-01-01'),
        conteudo: 'x'.repeat(300) + 'MOVE SALDO-DEVEDOR TO' + 'y'.repeat(300),
      },
    ]);

    const resultados = await service.pesquisar('SALDO-DEVEDOR');

    expect(queryBuilder.where).toHaveBeenCalled();
    expect(queryBuilder.orWhere).toHaveBeenCalled();
    expect(resultados).toHaveLength(1);
    expect(resultados[0].trecho).toContain('SALDO-DEVEDOR');
    expect(resultados[0].trecho!.length).toBeLessThan(300);
  });

  it('pesquisar sem match de conteúdo ainda retorna os metadados, com trecho a partir do início', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 2,
        caminho: 'eli/AUE032.CPY',
        extensao: '.cpy',
        pastaRaiz: 'eli',
        tamanhoBytes: 500,
        modificadoEm: new Date('2026-01-01'),
        conteudo: null,
      },
    ]);

    const resultados = await service.pesquisar('inexistente');

    expect(resultados[0].trecho).toBeNull();
  });

  it('status agrega total indexado, total com conteúdo e data da última importação', async () => {
    repo.count.mockResolvedValue(658);
    queryBuilder.getCount.mockResolvedValue(658);
    queryBuilder.getRawOne.mockResolvedValue({ maximo: new Date('2026-07-18T12:00:00Z') });

    const status = await service.status();

    expect(status.totalIndexado).toBe(658);
    expect(status.totalComConteudo).toBe(658);
    expect(status.ultimaImportacaoEm).toEqual(new Date('2026-07-18T12:00:00Z'));
  });

  it('status nunca falha quando a tabela está vazia (nenhuma importação ainda)', async () => {
    repo.count.mockResolvedValue(0);
    queryBuilder.getCount.mockResolvedValue(0);
    queryBuilder.getRawOne.mockResolvedValue(undefined);

    const status = await service.status();

    expect(status.totalIndexado).toBe(0);
    expect(status.ultimaImportacaoEm).toBeNull();
  });
});
