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
  docserviceUrl: string;
  protocolosDir: string;
  protocolosPollMin: number;
  gmailRedirectUri: string;
  imapPollMin: number;
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
    // Serviço interno (FastAPI) de geração de documentos — nunca exposto publicamente,
    // roda no mesmo host (ver docservice/ e docs/migracao/02-decisao-arquitetura.md).
    docserviceUrl:
      process.env.MIGRACAO_DOCSERVICE_URL ?? 'http://127.0.0.1:8001',
    // Protocolos de Treinamento: pasta raiz sincronizada pelo OneDrive (Videos Pendentes/
    // Processados/Com Erro) — mesmo padrão de webapp/protocolos.py (env PROTOCOLOS_DIR).
    protocolosDir:
      process.env.MIGRACAO_PROTOCOLOS_DIR ??
      'C:\\SEG-EVE\\OneDrive - rech.com.br\\PortalImplantacao\\Treinamentos',
    protocolosPollMin: Number(process.env.MIGRACAO_PROTOCOLOS_POLL_MIN ?? 10),
    // Gmail API (bypass de SMTP bloqueado): fluxo OAuth "Web application" com callback
    // real (decisão deliberada, diferente do "Desktop app" do Flask original — ver
    // GmailService e docs/migracao/03-documento-conversao.md). Precisa bater com o
    // redirect URI autorizado cadastrado no Google Cloud Console.
    gmailRedirectUri:
      process.env.MIGRACAO_GMAIL_REDIRECT_URI ??
      `http://localhost:${Number(process.env.MIGRACAO_PORT ?? 3000)}/api/config/gmail/callback`,
    // Robô da caixa de entrada (fechamento automático via IMAP) — mesmo padrão do
    // PROTOCOLOS_POLL_MIN (piso real de 2 min), env IMAP_POLL_MIN no Flask original.
    imapPollMin: Number(process.env.MIGRACAO_IMAP_POLL_MIN ?? 10),
  };
};
