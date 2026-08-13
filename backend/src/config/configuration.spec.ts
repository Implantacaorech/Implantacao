import configuration, { ehProducao } from './configuration';

describe('configuration — segredos de JWT', () => {
  const env = { ...process.env };

  beforeEach(() => {
    // MIGRACAO_DB_URL pode vazar do ambiente do usuário (o README do e2e avisa disso). Se
    // vazasse aqui, `ehProducao` trataria o teste como produção e o caso do fallback quebraria
    // sozinho — limpar explicitamente é o que mantém a suíte independente da máquina.
    delete process.env.MIGRACAO_DB_URL;
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it('usa o fallback de desenvolvimento fora de produção e sem banco real', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.MIGRACAO_JWT_SECRET;
    delete process.env.MIGRACAO_JWT_REFRESH_SECRET;
    const cfg = configuration();
    expect(cfg.jwtSecret).toBe('dev-only-secret-troque-em-producao');
    expect(cfg.jwtRefreshSecret).toBe(
      'dev-only-refresh-secret-troque-em-producao',
    );
  });

  it('falha o boot em produção sem MIGRACAO_JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.MIGRACAO_JWT_REFRESH_SECRET = 'algum-valor';
    delete process.env.MIGRACAO_JWT_SECRET;
    expect(() => configuration()).toThrow(/MIGRACAO_JWT_SECRET/);
  });

  it('falha o boot em produção sem MIGRACAO_JWT_REFRESH_SECRET', () => {
    process.env.NODE_ENV = 'production';
    process.env.MIGRACAO_JWT_SECRET = 'algum-valor';
    delete process.env.MIGRACAO_JWT_REFRESH_SECRET;
    expect(() => configuration()).toThrow(/MIGRACAO_JWT_REFRESH_SECRET/);
  });

  it('sobe normalmente em produção com os dois segredos definidos', () => {
    process.env.NODE_ENV = 'production';
    process.env.MIGRACAO_JWT_SECRET = 'segredo-real';
    process.env.MIGRACAO_JWT_REFRESH_SECRET = 'segredo-refresh-real';
    const cfg = configuration();
    expect(cfg.jwtSecret).toBe('segredo-real');
    expect(cfg.jwtRefreshSecret).toBe('segredo-refresh-real');
  });

  // Auditoria 2026-08-12 (C1): mesmo SEM NODE_ENV=production, um banco MariaDB real configurado
  // já é sinal de produção e deve exigir segredos fortes — fecha o caminho de subir por
  // `node dist/main.js`/serviço esquecendo o NODE_ENV.
  it('trata MariaDB configurado como produção mesmo sem NODE_ENV=production', () => {
    process.env.NODE_ENV = 'development';
    process.env.MIGRACAO_DB_URL =
      'mysql://painel:senha@localhost:3306/painel_novo';
    delete process.env.MIGRACAO_JWT_SECRET;
    process.env.MIGRACAO_JWT_REFRESH_SECRET = 'algum-valor';
    expect(() => configuration()).toThrow(/MIGRACAO_JWT_SECRET/);
  });

  describe('ehProducao', () => {
    it('é produção quando NODE_ENV=production', () => {
      expect(ehProducao('production', undefined)).toBe(true);
    });
    it('é produção quando a URL é mysql:// ou mariadb://', () => {
      expect(ehProducao('development', 'mysql://u:p@h/db')).toBe(true);
      expect(ehProducao('development', 'mariadb://u:p@h/db')).toBe(true);
    });
    it('NÃO é produção em dev/teste sem banco real', () => {
      expect(ehProducao('development', undefined)).toBe(false);
      expect(ehProducao('test', '')).toBe(false);
    });
  });
});
