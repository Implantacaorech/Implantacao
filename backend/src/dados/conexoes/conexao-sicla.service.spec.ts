import { Test, TestingModule } from '@nestjs/testing';
import { rmSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';
import { ConexaoSiclaService } from './conexao-sicla.service';

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

/** A CONEXÃO com o SICLA — configuração (credenciais, SELECTs, modo thick) e o executor
 * Oracle. Veio de `disponibilidade/disponibilidade.service.spec.ts` junto com o driver, na
 * fase 2 do ADR-0003: o domínio de ocupação continua testado lá, agora contra a pilha
 * completa da API de Dados. */
describe('ConexaoSiclaService', () => {
  let service: ConexaoSiclaService;
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
      providers: [ConexaoSiclaService],
    }).compile();
    service = module.get(ConexaoSiclaService);
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

  describe('executarSql — guarda de SELECT e tradução de erro', () => {
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

  describe('sqlDeConfiguracao', () => {
    it('devolve o texto CRU da configuração — o fallback é do catálogo', () => {
      expect(service.sqlDeConfiguracao('select')).toBe('');
      expect(service.sqlDeConfiguracao('selectTecnicos')).toBe('');

      service.salvarConfig({
        select: 'SELECT 1 FROM ocupacao',
        selectTecnicos: 'SELECT 2 FROM meus_tecnicos',
      });
      expect(service.sqlDeConfiguracao('select')).toBe(
        'SELECT 1 FROM ocupacao',
      );
      expect(service.sqlDeConfiguracao('selectTecnicos')).toBe(
        'SELECT 2 FROM meus_tecnicos',
      );
    });
  });
});
