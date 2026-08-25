import { rmSync } from 'fs';
import { join } from 'path';
import { createConnection as createConnectionReal } from 'mysql2/promise';
import { ConexaoPortalService } from './conexao-portal.service';

// mysql2 é mockado por completo: os testes cobrem config, guarda de SELECT e o roteamento
// de binds/opções — a conexão real só existe em produção, com o banco do Portal cadastrado.
// `jest.mock` é içado acima dos imports, então o símbolo importado acima JÁ é o mock — daí
// bastar a asserção de tipo (o `require()` que fazia esse papel é barrado pelo lint).
jest.mock('mysql2/promise', () => ({ createConnection: jest.fn() }));

const createConnection = createConnectionReal as unknown as jest.Mock;

describe('ConexaoPortalService', () => {
  let svc: ConexaoPortalService;

  beforeEach(() => {
    jest.clearAllMocks();
    rmSync(
      join(
        process.cwd(),
        'dados',
        `portal_db_test_${process.env.JEST_WORKER_ID ?? '0'}`,
      ),
      { recursive: true, force: true },
    );
    svc = new ConexaoPortalService();
  });

  describe('config (dados/portal_db.json)', () => {
    it('nasce vazia e inativa; salvar preenche e ativa', () => {
      expect(svc.configurado()).toBe(false);
      svc.salvarConfig({
        host: 'portal.rech.com.br',
        porta: '3306',
        banco: 'portal',
        usuario: 'leitura',
        senha: 's3nh4',
        ativo: true,
      });
      expect(svc.configurado()).toBe(true);
      const cfg = svc.carregarConfig();
      expect(cfg.host).toBe('portal.rech.com.br');
      expect(cfg.senha).toBe('s3nh4');
    });

    it('senha em branco na edição MANTÉM a atual (regra da Disponibilidade)', () => {
      svc.salvarConfig({
        host: 'h',
        banco: 'b',
        senha: 'original',
        ativo: true,
      });
      svc.salvarConfig({ host: 'h2', banco: 'b', senha: '', ativo: true });
      const cfg = svc.carregarConfig();
      expect(cfg.host).toBe('h2');
      expect(cfg.senha).toBe('original');
    });

    it('URL completa também configura (prevalece sobre os campos)', () => {
      svc.salvarConfig({
        url: 'mysql://u:p@10.0.0.5:3307/portal',
        ativo: true,
      });
      expect(svc.configurado()).toBe(true);
    });
  });

  describe('executarSql', () => {
    beforeEach(() => {
      svc.salvarConfig({
        host: 'h',
        porta: '3307',
        banco: 'portal',
        usuario: 'u',
        senha: 'p',
        ativo: true,
      });
    });

    it('recusa comando que não é SELECT/WITH sem nem conectar', async () => {
      const r = await svc.executarSql('DELETE FROM visita');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('SELECT');
      expect(createConnection).not.toHaveBeenCalled();
    });

    it('avisa quando a conexão não está cadastrada/ativa', async () => {
      svc.salvarConfig({ ativo: false });
      const r = await svc.executarSql('SELECT 1');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('não configurada');
    });

    it('conecta com namedPlaceholders/dateStrings, roda via query() e corta no teto', async () => {
      const end = jest.fn().mockResolvedValue(undefined);
      const query = jest
        .fn()
        .mockResolvedValue([[{ PROTOCOLO: 1 }, { PROTOCOLO: 2 }], []]);
      createConnection.mockResolvedValue({ query, end });

      const r = await svc.executarSql(
        'SELECT ID AS PROTOCOLO FROM visita WHERE DATA >= :data_ini',
        { data_ini: '2026-08-01' },
        1,
      );
      expect(createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'h',
          port: 3307,
          database: 'portal',
          user: 'u',
          password: 'p',
          namedPlaceholders: true,
          dateStrings: true,
        }),
      );
      // query() e não execute(): o prepared binário recusa bind em contexto IS NULL
      // ("Incorrect arguments to mysqld_stmt_execute").
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ sql: expect.stringContaining('SELECT') }),
        { data_ini: '2026-08-01' },
      );
      expect(r.ok).toBe(true);
      expect(r.linhas).toEqual([{ PROTOCOLO: 1 }]); // teto = 1
      expect(r.colunas).toEqual(['PROTOCOLO']);
      expect(end).toHaveBeenCalled(); // conexão sempre fechada
    });

    it('remove linhas de comentário antes de enviar (um :bind citado em comentário embaralha o driver)', async () => {
      const end = jest.fn().mockResolvedValue(undefined);
      const query = jest.fn().mockResolvedValue([[], []]);
      createConnection.mockResolvedValue({ query, end });

      await svc.executarSql(
        '-- binds: data_ini e data_fim vêm da tela\nSELECT 1 FROM visita WHERE DATA >= :data_ini',
        { data_ini: '2026-08-01' },
      );
      const enviado = (query.mock.calls[0][0] as { sql: string }).sql;
      expect(enviado).not.toContain('--');
      expect(enviado).toContain('SELECT 1 FROM visita');
    });

    it('erro do driver vira mensagem amigável (e a conexão fecha)', async () => {
      const end = jest.fn().mockResolvedValue(undefined);
      createConnection.mockResolvedValue({
        query: jest.fn().mockRejectedValue(new Error('Access denied')),
        end,
      });
      const r = await svc.executarSql('SELECT 1');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('Access denied');
      expect(end).toHaveBeenCalled();
    });
  });
});
