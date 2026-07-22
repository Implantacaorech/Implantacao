import configuration from './configuration';

describe('configuration — segredos de JWT', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('usa o fallback de desenvolvimento fora de produção', () => {
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
});
