import { Test, TestingModule } from '@nestjs/testing';
import { rmSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';
import { DisponibilidadeService } from './disponibilidade.service';

jest.mock('oracledb', () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn(),
    initOracleClient: jest.fn(),
    OUT_FORMAT_OBJECT: 4002,
  },
}));

describe('DisponibilidadeService', () => {
  let service: DisponibilidadeService;
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
      providers: [DisponibilidadeService],
    }).compile();
    service = module.get(DisponibilidadeService);
  });

  afterAll(() => {
    rmSync(dirTeste, { recursive: true, force: true });
  });

  function conexaoFake(execute: jest.Mock) {
    return { execute, close: jest.fn().mockResolvedValue(undefined) };
  }

  describe('config', () => {
    it('carrega valores vazios/falsos por padrão', () => {
      const cfg = service.carregarConfig();
      expect(cfg.host).toBe('');
      expect(cfg.ativo).toBe(false);
    });

    it('salva e recarrega, preservando a senha quando reenviada em branco', () => {
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'SICLA',
        senha: 'segredo',
        ativo: true,
      });
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'SICLA',
        senha: '',
        ativo: true,
      });
      const cfg = service.carregarConfig();
      expect(cfg.senha).toBe('segredo');
      expect(cfg.host).toBe('db.exemplo');
    });

    it('configurado exige ativo + select + conexão montável', () => {
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT 1',
        ativo: false,
      });
      expect(service.configurado()).toBe(false);
      // salvarConfig sobrescreve o registro inteiro (exceto senha) a cada chamada — mesmo
      // contrato de "reenvio do form inteiro" do Flask original (webapp/disponibilidade.py:
      // salvar_cfg) e de MailerService/ImapIntakeService nesta mesma migração; por isso os
      // campos de texto precisam ser reenviados aqui, não é um PATCH parcial.
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT 1',
        ativo: true,
      });
      expect(service.configurado()).toBe(true);
    });

    it('configurado é falso sem host nem url mesmo com ativo+select', () => {
      service.salvarConfig({ select: 'SELECT 1', ativo: true });
      expect(service.configurado()).toBe(false);
    });

    it('salvarConfig sobrescreve campos de texto não reenviados (não é um PATCH parcial)', () => {
      service.salvarConfig({ host: 'db.exemplo', banco: 'S', ativo: true });
      service.salvarConfig({ ativo: true }); // reenvio "vazio" apaga host/banco, como no Flask
      const cfg = service.carregarConfig();
      expect(cfg.host).toBe('');
      expect(cfg.banco).toBe('');
    });
  });

  describe('filtraPorTecnico', () => {
    it('detecta :tecnicos como token isolado, não como prefixo de outro nome', () => {
      expect(
        service.filtraPorTecnico({
          ...service.carregarConfig(),
          select: 'WHERE cod IN :tecnicos',
        }),
      ).toBe(true);
      expect(
        service.filtraPorTecnico({
          ...service.carregarConfig(),
          select: 'WHERE cod IN :tecnicos_outros',
        }),
      ).toBe(false);
      expect(
        service.filtraPorTecnico({
          ...service.carregarConfig(),
          select: 'SELECT 1',
        }),
      ).toBe(false);
    });
  });

  describe('consultar / executarSql — binds e expansão de :tecnicos', () => {
    it('consultar expande :tecnicos em binds nomeados e normaliza a linha (case-insensitive)', async () => {
      const execute = jest.fn().mockResolvedValue({
        rows: [
          { TECNICO: 'Ana', DATA: '2026-08-10T00:00:00.000Z', TURNO: 'MANHA' },
        ],
      });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x WHERE cod IN :tecnicos',
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
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x WHERE cod IN :tecnicos',
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

    it('executarSql rejeita comandos que não são SELECT/WITH', async () => {
      const r = await service.executarSql('DELETE FROM algo');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('SELECT');
      expect(mockedOracledb.getConnection).not.toHaveBeenCalled();
    });

    it('executarSql ignora comentários iniciais ao validar SELECT/WITH', async () => {
      const execute = jest.fn().mockResolvedValue({ rows: [], metaData: [] });
      mockedOracledb.getConnection.mockResolvedValue(conexaoFake(execute));
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT 1',
        ativo: true,
      });
      const r = await service.executarSql(
        '-- comentário\n/* bloco */\nSELECT 1 FROM dual',
      );
      expect(r.ok).toBe(true);
    });

    it('executarSql aceita consulta vazia com mensagem própria, sem tentar conectar', async () => {
      const r = await service.executarSql('   ');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('vazia');
      expect(mockedOracledb.getConnection).not.toHaveBeenCalled();
    });

    it('executarSql traduz erro DPY-3015 (verificador de senha antigo) numa mensagem amigável', async () => {
      mockedOracledb.getConnection.mockRejectedValue(
        new Error('DPY-3015: password verifier type is not supported'),
      );
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select: 'SELECT 1',
        ativo: true,
      });
      const r = await service.executarSql('SELECT 1 FROM dual');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('Modo thick');
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
      service.salvarConfig({
        host: 'db.exemplo',
        banco: 'S',
        select:
          'SELECT t AS tecnico, d AS data, tu AS turno FROM x WHERE cod IN :tecnicos',
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
      service.salvarConfig({
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
      service.salvarConfig({
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
      service.salvarConfig({
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
