import { Test, TestingModule } from '@nestjs/testing';
import { rmSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';
import { DisponibilidadeService } from './disponibilidade.service';
import { ConsultaBdService } from '../dados/consulta-bd.service';
import { DadosService } from '../dados/dados.service';
import { ConexoesService } from '../dados/conexoes/conexoes.service';
import { ConexaoSiclaService } from '../dados/conexoes/conexao-sicla.service';
import { ConexaoPortalService } from '../dados/conexoes/conexao-portal.service';
import { CatalogoService } from '../dados/catalogo/catalogo.service';

jest.mock('oracledb', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    initOracleClient: jest.fn(),
    OUT_FORMAT_OBJECT: 4002,
    // O serviço configura `fetchAsString = [CLOB]` ao carregar (CLOB → texto).
    CLOB: 2017,
  },
}));

/** DOMÍNIO da disponibilidade, montado sobre a PILHA REAL da API de Dados (catálogo →
 * conexões → driver Oracle mockado). É de propósito: depois da fase 2 do ADR-0003 estas
 * consultas passaram a ir pelo catálogo, e o que precisa ficar provado é que o caminho
 * inteiro chega ao banco com o SQL e os binds certos — inclusive a expansão de `:tecnicos`,
 * que mudou de casa (era `expandirTecnicos` aqui, virou o tipo `lista_texto` do catálogo). */
describe('DisponibilidadeService', () => {
  let service: DisponibilidadeService;
  let conexao: ConexaoSiclaService;
  const mockedOracledb = oracledb as unknown as {
    getConnection: jest.Mock;
    initOracleClient: jest.Mock;
  };

  const dirTeste = join(
    process.cwd(),
    'dados',
    `disponibilidade_test_${process.env.JEST_WORKER_ID ?? '0'}`,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    rmSync(dirTeste, { recursive: true, force: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisponibilidadeService,
        DadosService,
        // O catálogo efetivo entra inteiro: é ele que resolve `sicla.disponibilidade.*`,
        // cujo SQL vem da CONFIGURAÇÃO da conexão.
        CatalogoService,
        ConexoesService,
        ConexaoSiclaService,
        ConexaoPortalService,
        // As duas consultas de disponibilidade vêm da CONFIGURAÇÃO da conexão, não de
        // Consultas BD — este dublê existe só para satisfazer a injeção.
        {
          provide: ConsultaBdService,
          useValue: {
            porSlug: jest.fn().mockResolvedValue(null),
            // O CatalogoService lê as consultas publicadas pela tela; aqui não há nenhuma.
            listar: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();
    service = module.get(DisponibilidadeService);
    conexao = module.get(ConexaoSiclaService);
  });

  afterAll(() => {
    rmSync(dirTeste, { recursive: true, force: true });
  });

  function conexaoFake(execute: jest.Mock) {
    return { execute, close: jest.fn().mockResolvedValue(undefined) };
  }

  describe('consultar — o SELECT da configuração, com :tecnicos expandido pelo catálogo', () => {
    it('consultar expande :tecnicos em binds nomeados e normaliza a linha (case-insensitive)', async () => {
      const execute = jest.fn().mockResolvedValue({
        rows: [
          { TECNICO: 'Ana', DATA: '2026-08-10T00:00:00.000Z', TURNO: 'MANHA' },
        ],
      });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        // SELECT realista: cita as datas E `:tecnicos`. Se citasse só `:tecnicos`, o
        // catálogo descartaria os binds de data — comportamento correto e mais seguro que
        // o anterior, que os mandava sempre (bind sobrando é ORA-01036 no Oracle).
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x ' +
          'WHERE d BETWEEN :data_ini AND :data_fim AND cod IN :tecnicos',
        ativo: true,
      });

      const linhas = await service.consultar('2026-08-01', '2026-08-31', [
        '123',
        '456',
      ]);
      expect(linhas).toEqual([
        { tecnico: 'Ana', data: '2026-08-10', turno: 'manha' },
      ]);

      const [sqlChamado, bindsChamados] = execute.mock.calls[0];
      expect(sqlChamado).toContain('(:tecnicos_0, :tecnicos_1)');
      expect(bindsChamados).toEqual({
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
        tecnicos_0: '123',
        tecnicos_1: '456',
      });
    });

    it('lista de técnicos vazia vira (NULL) — nunca casa, sem binds extras', async () => {
      const execute = jest.fn().mockResolvedValue({ rows: [] });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        // SELECT realista: cita as datas E `:tecnicos`. Se citasse só `:tecnicos`, o
        // catálogo descartaria os binds de data — comportamento correto e mais seguro que
        // o anterior, que os mandava sempre (bind sobrando é ORA-01036 no Oracle).
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x ' +
          'WHERE d BETWEEN :data_ini AND :data_fim AND cod IN :tecnicos',
        ativo: true,
      });
      await service.consultar('2026-08-01', '2026-08-31', []);
      const [sqlChamado, bindsChamados] = execute.mock.calls[0];
      expect(sqlChamado).toContain('(NULL)');
      expect(bindsChamados).toEqual({
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
      });
    });
  });

  describe('ocupacaoPorSlot — tradução código/nome e re-indexação por alias', () => {
    it('aceita código OU nome no cadastro e indexa a ocupação pelos dois', async () => {
      const executeTecnicos = jest.fn().mockResolvedValue({
        rows: [{ CODIGO: '007', TECNICO: 'Ana Consultora' }],
      });
      const executeOcupacao = jest.fn().mockResolvedValue({
        rows: [{ TECNICO: 'Ana Consultora', DATA: '2026-08-10', TURNO: '' }],
      });
      mockedOracledb.getConnection
        .mockResolvedValueOnce(conexaoFake(executeTecnicos))
        .mockResolvedValueOnce(conexaoFake(executeOcupacao));
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        // SELECT realista: cita as datas E `:tecnicos`. Se citasse só `:tecnicos`, o
        // catálogo descartaria os binds de data — comportamento correto e mais seguro que
        // o anterior, que os mandava sempre (bind sobrando é ORA-01036 no Oracle).
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x ' +
          'WHERE d BETWEEN :data_ini AND :data_fim AND cod IN :tecnicos',
        ativo: true,
      });

      const ocup = await service.ocupacaoPorSlot('2026-08-01', '2026-08-31', [
        '007',
      ]);
      // turno vazio = dia inteiro -> ocupa manhã E tarde
      expect(ocup['007|2026-08-10|manha']).toBe(true);
      expect(ocup['007|2026-08-10|tarde']).toBe(true);
      expect(ocup['ana consultora|2026-08-10|manha']).toBe(true);
    });
  });

  describe('ocupacaoPorSlotCache', () => {
    it('não repete a consulta dentro do TTL, mesmo com técnicos em ordem diferente', async () => {
      const execute = jest.fn().mockResolvedValue({ rows: [] });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT t AS tecnico, d AS data, tu AS turno FROM x',
        ativo: true,
      });

      // 1ª chamada (cache miss) faz 2 consultas de verdade: mapaTecnicos() (traduz
      // código/nome) + consultar() — ver ocupacaoPorSlot. A 2ª chamada, mesma janela e os
      // mesmos técnicos em ordem diferente, precisa bater no cache e não gerar NENHUMA
      // consulta nova.
      await service.ocupacaoPorSlotCache('2026-08-01', '2026-08-31', [
        'A',
        'B',
      ]);
      expect(mockedOracledb.getConnection).toHaveBeenCalledTimes(2);
      await service.ocupacaoPorSlotCache('2026-08-01', '2026-08-31', [
        'B',
        'A',
      ]);
      expect(mockedOracledb.getConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe('testar', () => {
    it('sucesso: devolve amostra limitada a 8 linhas', async () => {
      const linhas = Array.from({ length: 20 }, (_, i) => ({
        TECNICO: `T${i}`,
        DATA: '2026-08-10',
        TURNO: '',
      }));
      const execute = jest.fn().mockResolvedValue({ rows: linhas });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT t AS tecnico, d AS data, tu AS turno FROM x',
        ativo: true,
      });
      const r = await service.testar();
      expect(r.ok).toBe(true);
      expect(r.amostra).toHaveLength(8);
    });

    it('erro de conexão devolve mensagem amigável, não a exceção crua', async () => {
      mockedOracledb.getConnection.mockRejectedValue(
        new Error('ORA-12154: TNS could not resolve'),
      );
      conexao.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT 1',
        ativo: true,
      });
      const r = await service.testar();
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('ORA-12154');
    });
  });
});
