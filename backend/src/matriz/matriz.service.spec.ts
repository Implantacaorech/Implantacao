import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { Workbook } from 'exceljs';
import { MatrizService } from './matriz.service';
import { MatrizCompetencia } from '../database/entities/matriz-competencia.entity';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';

describe('MatrizService', () => {
  let service: MatrizService;
  const competencias = {
    find: jest.fn(),
    save: jest.fn((e) => Promise.resolve(e)),
    create: jest.fn((dto) => dto),
  };
  const tecnicos = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((e) => Promise.resolve(e)),
    create: jest.fn((dto) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatrizService,
        {
          provide: getRepositoryToken(MatrizCompetencia),
          useValue: competencias,
        },
        { provide: getRepositoryToken(MatrizTecnico), useValue: tecnicos },
      ],
    }).compile();
    service = module.get(MatrizService);
  });

  describe('notas', () => {
    it('parseia o JSON de notas; devolve {} se inválido', () => {
      expect(service.notas({ notas: '{"FAT01":8}' } as MatrizTecnico)).toEqual({
        FAT01: 8,
      });
      expect(service.notas({ notas: 'não é json' } as MatrizTecnico)).toEqual(
        {},
      );
      expect(service.notas({ notas: '' } as MatrizTecnico)).toEqual({});
    });
  });

  describe('linhaDoUsuario', () => {
    it('casa pelo Código SICLA (prioridade sobre o nome)', async () => {
      tecnicos.find.mockResolvedValue([
        { id: 1, nome: '007' },
        { id: 2, nome: 'Fulano' },
      ]);
      const r = await service.linhaDoUsuario('Fulano de Tal', '007');
      expect(r?.id).toBe(1);
    });

    it('casa pelo nome quando não bate por código, case-insensitive', async () => {
      tecnicos.find.mockResolvedValue([{ id: 2, nome: 'fulano' }]);
      const r = await service.linhaDoUsuario('Fulano', '999');
      expect(r?.id).toBe(2);
    });

    it('sem chaves (nome e código vazios) devolve null sem consultar o repositório', async () => {
      const r = await service.linhaDoUsuario('', '');
      expect(r).toBeNull();
      expect(tecnicos.find).not.toHaveBeenCalled();
    });

    it('nenhuma linha bate -> null', async () => {
      tecnicos.find.mockResolvedValue([{ id: 1, nome: 'Outro' }]);
      const r = await service.linhaDoUsuario('Fulano', '007');
      expect(r).toBeNull();
    });
  });

  describe('salvarNotas', () => {
    it('devolve false quando o técnico não existe', async () => {
      tecnicos.findOne.mockResolvedValue(null);
      expect(await service.salvarNotas(1, {}, 'Admin')).toBe(false);
    });

    it('clampa 0-10, remove nota quando o valor vem vazio, ignora sigla não cadastrada', async () => {
      const t = {
        id: 1,
        notas: JSON.stringify({ FAT01: 5, FAT02: 3 }),
        setor: '',
        dias: '',
      };
      tecnicos.findOne.mockResolvedValue(t);
      competencias.find.mockResolvedValue([
        { sigla: 'FAT01' },
        { sigla: 'FAT02' },
      ]);

      const ok = await service.salvarNotas(
        1,
        { notas: { FAT01: '99', FAT02: '', SIGLA_INEXISTENTE: '5' } },
        'Ana',
      );

      expect(ok).toBe(true);
      const salvas = JSON.parse(t.notas);
      expect(salvas).toEqual({ FAT01: 10 }); // clamp em 10; FAT02 removida; sigla desconhecida ignorada
      expect(t.atualizadoPor).toBe('Ana');
    });

    it('atualiza setor/dias só quando enviados no form', async () => {
      const t = { id: 1, notas: '{}', setor: 'Antigo', dias: '10' };
      tecnicos.findOne.mockResolvedValue(t);
      competencias.find.mockResolvedValue([]);

      await service.salvarNotas(1, { dias: '20' }, 'Ana');

      expect(t.dias).toBe('20');
      expect(t.setor).toBe('Antigo'); // não veio no form -> não mexe
    });
  });

  describe('importar', () => {
    const DIR = join(
      process.cwd(),
      'dados',
      `matriz_test_${process.env.JEST_WORKER_ID ?? '0'}`,
    );
    const ARQUIVO = join(DIR, 'matriz.xlsx');

    beforeAll(async () => {
      mkdirSync(DIR, { recursive: true });
      const wb = new Workbook();
      const ws = wb.addWorksheet('Matriz');
      ws.getCell('B8').value = 'Nome';
      ws.getCell('C8').value = 'Dias';
      ws.getCell('D8').value = 'Setor';
      ws.getCell('E7').value = 'GERAIS';
      ws.getCell('E8').value = 'FAT01';
      ws.getCell('B9').value = 'Ana Técnica';
      ws.getCell('C9').value = '120';
      ws.getCell('D9').value = 'Implantação';
      ws.getCell('E9').value = 8;
      await wb.xlsx.writeFile(ARQUIVO);
    });

    afterAll(() => {
      rmSync(DIR, { recursive: true, force: true });
    });

    it('cria competências e técnicos novos a partir da planilha', async () => {
      competencias.find.mockResolvedValue([]);
      tecnicos.find.mockResolvedValue([]);

      const r = await service.importar('Admin', ARQUIVO);

      expect(r).toEqual({
        novasCompetencias: 1,
        novosTecnicos: 1,
        ignorados: 0,
      });
      expect(competencias.save).toHaveBeenCalledWith(
        expect.objectContaining({ sigla: 'FAT01', area: 'Gerais' }),
      );
      expect(tecnicos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Ana Técnica',
          atualizadoPor: 'Admin',
        }),
      );
    });

    it('é aditivo — não sobrescreve técnico já cadastrado (case-insensitive)', async () => {
      competencias.find.mockResolvedValue([{ sigla: 'FAT01' }]);
      tecnicos.find.mockResolvedValue([{ nome: 'ana técnica' }]);

      const r = await service.importar('Admin', ARQUIVO);

      expect(r).toEqual({
        novasCompetencias: 0,
        novosTecnicos: 0,
        ignorados: 1,
      });
      expect(tecnicos.save).not.toHaveBeenCalled();
    });
  });
});
