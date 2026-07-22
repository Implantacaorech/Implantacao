import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsultaBdService } from './consulta-bd.service';
import { ConsultaBD } from '../database/entities/consulta-bd.entity';

describe('ConsultaBdService', () => {
  let service: ConsultaBdService;
  const repo = {
    findOne: jest.fn(),
    save: jest.fn((entity) =>
      Promise.resolve({ id: entity.id ?? 1, ...entity }),
    ),
    create: jest.fn((dto) => dto),
    remove: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultaBdService,
        { provide: getRepositoryToken(ConsultaBD), useValue: repo },
      ],
    }).compile();
    service = module.get(ConsultaBdService);
  });

  describe('seedPadrao', () => {
    it('semeia quando não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      const criou = await service.seedPadrao();
      expect(criou).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'previsao_inicio_oficial',
          mostrarGrafico: true,
        }),
      );
    });

    it('é idempotente — não sobrescreve se já existe (mesmo editado pelo ADM)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        slug: 'previsao_inicio_oficial',
        nome: 'Editado pelo ADM',
      });
      const criou = await service.seedPadrao();
      expect(criou).toBe(false);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('salvar', () => {
    it('normaliza o slug (minúsculo, espaços -> underscore)', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.salvar('Minha Consulta Nova', {
        nome: 'X',
        sql: 'SELECT 1',
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'minha_consulta_nova' }),
      );
    });

    it('slug vazio devolve null sem tocar o repositório', async () => {
      const r = await service.salvar('   ');
      expect(r).toBeNull();
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('ao atualizar, campos não enviados (undefined) não são tocados', async () => {
      const existente = {
        id: 5,
        slug: 'x',
        nome: 'Nome antigo',
        sql: 'SELECT 1',
        ordem: 2,
      };
      repo.findOne.mockResolvedValue(existente);
      await service.salvar('x', { sql: 'SELECT 2' });
      expect(existente.nome).toBe('Nome antigo');
      expect(existente.sql).toBe('SELECT 2');
    });
  });

  describe('excluir', () => {
    it('devolve false quando o slug não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.excluir('nao-existe')).toBe(false);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('remove quando existe', async () => {
      repo.findOne.mockResolvedValue({ id: 1, slug: 'x' });
      expect(await service.excluir('x')).toBe(true);
      expect(repo.remove).toHaveBeenCalled();
    });
  });
});
