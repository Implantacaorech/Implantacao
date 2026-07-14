export interface AppConfig {
  env: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  db: {
    type: 'postgres' | 'better-sqlite3';
    url?: string;
    sqlitePath?: string;
  };
  corsOrigins: string[];
}

// Todas as variáveis deste backend novo usam o prefixo MIGRACAO_ — nunca o prefixo PAINEL_
// (esse é do Painel Flask em produção, schema antigo/incompatível). Os dois stacks rodam em
// paralelo durante a migração e podem compartilhar o mesmo shell/ambiente; ler uma variável
// PAINEL_* aqui por engano já causou uma conexão acidental ao Postgres de produção durante o
// desenvolvimento (ver docs/migracao/03-documento-conversao.md).
export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const dbUrl = process.env.MIGRACAO_DB_URL;
  return {
    env,
    port: Number(process.env.MIGRACAO_PORT ?? 3000),
    jwtSecret:
      process.env.MIGRACAO_JWT_SECRET ?? 'dev-only-secret-troque-em-producao',
    jwtExpiresIn: process.env.MIGRACAO_JWT_EXPIRES_IN ?? '15m',
    jwtRefreshSecret:
      process.env.MIGRACAO_JWT_REFRESH_SECRET ??
      'dev-only-refresh-secret-troque-em-producao',
    jwtRefreshExpiresIn: process.env.MIGRACAO_JWT_REFRESH_EXPIRES_IN ?? '7d',
    db: dbUrl
      ? { type: 'postgres', url: dbUrl }
      : {
          type: 'better-sqlite3',
          sqlitePath: process.env.MIGRACAO_DB_SQLITE ?? 'dados/painel.sqlite',
        },
    corsOrigins: (
      process.env.MIGRACAO_CORS_ORIGINS ?? 'http://localhost:4200'
    ).split(','),
  };
};
