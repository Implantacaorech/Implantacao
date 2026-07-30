import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { IndiceTopicoService } from './indice-topico.service';
import { IndiceTopico } from '../database/entities/indice-topico.entity';

describe('IndiceTopicoService — importação do YAML', () => {
  let service: IndiceTopicoService;
  let dir: string;

  const repo = {
    count: jest.fn(),
    clear: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((linhas) => Promise.resolve(linhas)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    dir = mkdtempSync(join(tmpdir(), 'indice-topico-'));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndiceTopicoService,
        { provide: getRepositoryToken(IndiceTopico), useValue: repo },
      ],
    }).compile();
    service = module.get(IndiceTopicoService);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('não faz nada se o catálogo já tiver dados (idempotente)', async () => {
    repo.count.mockResolvedValue(5);
    const n = await service.seedDoYaml(join(dir, 'nao-existe.yaml'));
    expect(n).toBe(5);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('devolve 0 e não quebra se o arquivo YAML não existir', async () => {
    repo.count.mockResolvedValue(0);
    const n = await service.seedDoYaml(join(dir, 'nao-existe.yaml'));
    expect(n).toBe(0);
  });

  it('importa as linhas do YAML mapeando os campos corretamente', async () => {
    repo.count.mockResolvedValue(0);
    const caminho = join(dir, 'indice.yaml');
    writeFileSync(
      caminho,
      [
        'linhas:',
        '- modulo_sigla: FAT',
        '  modulo: Faturamento',
        '  topico: Emissão de NF',
        '- modulo_sigla: EST',
        '  modulo: Estoque',
        '  topico: Inventário',
      ].join('\n'),
    );
    const n = await service.seedDoYaml(caminho);
    expect(n).toBe(2);
    expect(repo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        ordem: 0,
        moduloSigla: 'FAT',
        modulo: 'Faturamento',
        topico: 'Emissão de NF',
      }),
      expect.objectContaining({
        ordem: 1,
        moduloSigla: 'EST',
        modulo: 'Estoque',
        topico: 'Inventário',
      }),
    ]);
  });

  it('reimportar limpa a tabela antes de recarregar do YAML', async () => {
    repo.count.mockResolvedValue(10); // já tinha dados — reimportar ignora isso
    const caminho = join(dir, 'indice.yaml');
    writeFileSync(
      caminho,
      'linhas:\n- modulo_sigla: FAT\n  modulo: Faturamento\n  topico: X\n',
    );
    const n = await service.reimportar(caminho);
    expect(repo.clear).toHaveBeenCalled();
    expect(n).toBe(1);
  });

  it('porCodigos devolve vazio, sem consultar, quando não há códigos', async () => {
    const r = await service.porCodigos(['', '  ']);
    expect(r).toEqual([]);
  });

  it('porCodigos consulta pelos códigos (módulo base OU adicional), sem duplicar', async () => {
    const getMany = jest.fn().mockResolvedValue([{ id: 1 }]);
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany,
    };
    (repo as unknown as { createQueryBuilder: jest.Mock }).createQueryBuilder =
      jest.fn().mockReturnValue(qb);
    const r = await service.porCodigos(['5', '5', '29']);
    expect(r).toEqual([{ id: 1 }]);
    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('moduloNum IN'),
      {
        cods: ['5', '29'],
      },
    );
  });
});
