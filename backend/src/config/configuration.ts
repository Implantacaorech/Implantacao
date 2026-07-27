import { join } from 'path';

export interface AppConfig {
  env: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  db: {
    type: 'postgres' | 'mariadb' | 'better-sqlite3';
    url?: string;
    sqlitePath?: string;
  };
  corsOrigins: string[];
  docserviceUrl: string;
  protocolosDir: string;
  protocolosPollMin: number;
  gmailRedirectUri: string;
  imapPollMin: number;
  /** Liga o robô que LÊ a caixa e cria projetos a partir do e-mail de fechamento. Desligado
   * por padrão desde 2026-07-27: a entrada do processo virou a consulta ao SICLA + cadastro
   * pelo Comercial (passo 1). Reative com MIGRACAO_IMAP_INTAKE_ATIVO=1 se precisar voltar. */
  imapIntakeAtivo: boolean;
  digestHora: number;
  digestPara: string;
  frontendDistPath: string;
  legadoPythonExe: string;
  legadoWebappDir: string;
}

// Todas as variáveis deste backend novo usam o prefixo MIGRACAO_ — nunca o prefixo PAINEL_
// (esse é do Painel Flask em produção, schema antigo/incompatível). Os dois stacks rodam em
// paralelo durante a migração e podem compartilhar o mesmo shell/ambiente; ler uma variável
// PAINEL_* aqui por engano já causou uma conexão acidental ao Postgres de produção durante o
// desenvolvimento (ver docs/migracao/03-documento-conversao.md).
// Em produção, um segredo de JWT previsível (o fallback de desenvolvimento, visível a
// qualquer um com acesso ao repositório no GitHub) permitiria forjar um token válido —
// inclusive de perfil ADM. Falha o boot em vez de subir silenciosamente inseguro (mesma
// lição de segurança já aplicada ao Flask legado, ver commit 778f324 "remove senha padrao
// do Postgres e fallback fraco de secret_key"). Fora de produção, mantém o fallback fixo
// (conveniência de desenvolvimento/teste — refresh tokens emitidos localmente não
// precisam sobreviver a um segredo trocado a cada boot).
function exigirEmProducao(
  env: string,
  valor: string | undefined,
  nomeVar: string,
  fallback: string,
): string {
  if (valor) return valor;
  if (env === 'production') {
    throw new Error(
      `${nomeVar} não está definida — obrigatória em produção (NODE_ENV=production). ` +
        'Defina a variável de ambiente antes de subir o backend.',
    );
  }
  return fallback;
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const dbUrl = process.env.MIGRACAO_DB_URL;
  return {
    env,
    port: Number(process.env.MIGRACAO_PORT ?? 3000),
    jwtSecret: exigirEmProducao(
      env,
      process.env.MIGRACAO_JWT_SECRET,
      'MIGRACAO_JWT_SECRET',
      'dev-only-secret-troque-em-producao',
    ),
    jwtExpiresIn: process.env.MIGRACAO_JWT_EXPIRES_IN ?? '15m',
    jwtRefreshSecret: exigirEmProducao(
      env,
      process.env.MIGRACAO_JWT_REFRESH_SECRET,
      'MIGRACAO_JWT_REFRESH_SECRET',
      'dev-only-refresh-secret-troque-em-producao',
    ),
    jwtRefreshExpiresIn: process.env.MIGRACAO_JWT_REFRESH_EXPIRES_IN ?? '7d',
    // Dialeto detectado pelo prefixo da própria MIGRACAO_DB_URL — em migração de
    // postgres->mariadb (2026-07), sem precisar de uma env var nova/separada.
    db: dbUrl
      ? /^(mysql|mariadb):\/\//i.test(dbUrl)
        ? { type: 'mariadb', url: dbUrl }
        : { type: 'postgres', url: dbUrl }
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
    // Entrada por e-mail DESLIGADA por padrão — a entrada agora é a consulta ao SICLA
    // (passo 1, feito pelo Comercial). Só liga se explicitamente pedido no ambiente.
    imapIntakeAtivo: ['1', 'true', 'sim'].includes(
      (process.env.MIGRACAO_IMAP_INTAKE_ATIVO ?? '').trim().toLowerCase(),
    ),
    // Resumo diário da Coordenação (KPIs + alertas por e-mail) — envs DIGEST_HORA/
    // DIGEST_PARA no Flask original. Sem tela de configuração (nem lá, nem aqui) — é
    // ajuste de ambiente/ops, não algo editável pelo ADM. O fallback de arquivo
    // `digest_para.txt` do Flask não foi portado (sem UI que o gerencie; só o env var).
    digestHora: Number(process.env.MIGRACAO_DIGEST_HORA ?? 8),
    digestPara: process.env.MIGRACAO_DIGEST_PARA ?? '',
    // Onde fica o build de produção do Angular (`ng build`, saída em
    // frontend/dist/frontend/browser) — o NestJS serve esses arquivos estáticos direto
    // (ver main.ts/ServeStaticModule), um único processo/porta em produção, mesmo padrão
    // de origem única do Painel Flask (evita CORS/reverse proxy para uma ferramenta
    // interna). process.cwd() é a pasta `backend/` quando rodado via `node dist/main.js`
    // a partir dela (mesmo padrão dos outros .bat do repositório).
    frontendDistPath:
      process.env.MIGRACAO_FRONTEND_DIST ??
      join(process.cwd(), '..', 'frontend', 'dist', 'frontend', 'browser'),
    // Ponte de subprocesso para o assistente administrativo legado (webapp/legado_cli.py)
    // — deliberadamente FORA do docservice (ver docs/migracao/02-decisao-arquitetura.md,
    // cujo escopo documentado é só geração fiel + transcrição). process.cwd() é `backend/`.
    legadoPythonExe: process.env.MIGRACAO_LEGADO_PYTHON ?? 'python',
    legadoWebappDir:
      process.env.MIGRACAO_LEGADO_WEBAPP_DIR ??
      join(process.cwd(), '..', 'webapp'),
  };
};
