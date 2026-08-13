import { join } from 'path';

export interface AppConfig {
  env: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  // Banco obrigatório pela §4.8 do Padrão Rech: MariaDB. `better-sqlite3` existe só como
  // banco DESCARTÁVEL de teste/dev (sem MIGRACAO_DB_URL) — nenhum outro dialeto é aceito.
  db: {
    type: 'mariadb' | 'better-sqlite3';
    url?: string;
    sqlitePath?: string;
  };
  corsOrigins: string[];
  /** Rate limit global (Guia Mestre de Arquitetura §Segurança). Janela em segundos e teto
   * de requisições por IP dentro dela. Generoso de propósito: é ferramenta interna, e as
   * telas de BI disparam várias chamadas por carregamento — o objetivo aqui é conter laço
   * descontrolado/abuso, não policiar o uso normal. */
  rateLimit: { ttlSegundos: number; limite: number };
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
  /** Pasta onde a Tarefa Agendada deixa os zips do dump e os logs de operação (backup e
   * Guardião). É de onde a vigilância de saúde lê — ver src/saude/. */
  backupDir: string;
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
/** "Isto é uma instância de produção?" — a pergunta que decide se um segredo fraco pode
 * valer. NÃO depende só de `NODE_ENV=production`: a auditoria de 2026-08-12 encontrou que
 * `NODE_ENV` nunca era definido no boot (nenhum `.bat`/serviço o setava), então o guarda de
 * segredo abaixo NUNCA disparava em produção e o backend podia subir assinando tokens com o
 * fallback publicado no repositório — suficiente para forjar um JWT de perfil ADM.
 *
 * A correção é dupla: (1) `Iniciar_Painel_Novo.bat` passou a exportar `NODE_ENV=production`;
 * e (2) esta função também trata como produção QUALQUER boot apontado para um banco MariaDB
 * real (`mysql://`/`mariadb://`). Assim, mesmo subindo por `node dist/main.js`, `start:prod`
 * ou um serviço que esqueça o `NODE_ENV`, um segredo ausente FALHA O BOOT em vez de cair no
 * fallback — porque um MariaDB configurado só existe em ambiente real, nunca em dev/teste
 * (que usam SQLite descartável). Dev/teste (sem `MIGRACAO_DB_URL`) seguem com o fallback fixo,
 * por conveniência: refresh tokens locais não precisam sobreviver a um segredo trocado a cada
 * boot. */
export function ehProducao(env: string, dbUrl: string | undefined): boolean {
  return env === 'production' || /^(mysql|mariadb):\/\//i.test(dbUrl ?? '');
}

function exigirEmProducao(
  producao: boolean,
  valor: string | undefined,
  nomeVar: string,
  fallback: string,
): string {
  if (valor) return valor;
  if (producao) {
    throw new Error(
      `${nomeVar} não está definida — é obrigatória quando o backend aponta para um banco ` +
        'real (MariaDB) ou roda com NODE_ENV=production. Sem ela, o backend usaria um ' +
        'segredo publicado no repositório e QUALQUER pessoa poderia forjar um token de ' +
        'perfil ADM. Defina a variável de ambiente antes de subir o backend.',
    );
  }
  return fallback;
}

/** MariaDB é o banco obrigatório do padrão (§4.8) — qualquer outro dialeto é recusado no
 * boot, com a mensagem dizendo o que fazer. `mysql://` é aceito porque é o prefixo que o
 * driver mysql2 usa para falar com o MariaDB. */
function exigirMariaDb(dbUrl: string): 'mariadb' {
  if (!/^(mysql|mariadb):\/\//i.test(dbUrl)) {
    const prefixo = /^([a-z0-9+.-]+):\/\//i.exec(dbUrl)?.[1] ?? '(sem prefixo)';
    throw new Error(
      `MIGRACAO_DB_URL aponta para "${prefixo}", mas o banco obrigatório do Padrão Rech ` +
        '(§4.8) é o MariaDB. Use uma URL mysql:// ou mariadb:// (ex.: ' +
        'mysql://usuario:senha@host:3306/painel_novo). Sem MIGRACAO_DB_URL, o backend usa ' +
        'SQLite descartável — só para desenvolvimento e teste.',
    );
  }
  return 'mariadb';
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const dbUrl = process.env.MIGRACAO_DB_URL;
  // Produção = NODE_ENV=production OU banco real configurado (ver ehProducao). Um dos dois
  // basta para exigir segredos fortes e recusar o fallback publicado.
  const producao = ehProducao(env, dbUrl);
  return {
    env,
    port: Number(process.env.MIGRACAO_PORT ?? 3000),
    jwtSecret: exigirEmProducao(
      producao,
      process.env.MIGRACAO_JWT_SECRET,
      'MIGRACAO_JWT_SECRET',
      'dev-only-secret-troque-em-producao',
    ),
    jwtExpiresIn: process.env.MIGRACAO_JWT_EXPIRES_IN ?? '15m',
    jwtRefreshSecret: exigirEmProducao(
      producao,
      process.env.MIGRACAO_JWT_REFRESH_SECRET,
      'MIGRACAO_JWT_REFRESH_SECRET',
      'dev-only-refresh-secret-troque-em-producao',
    ),
    jwtRefreshExpiresIn: process.env.MIGRACAO_JWT_REFRESH_EXPIRES_IN ?? '7d',
    // MIGRACAO_DB_URL definida => MariaDB, e o prefixo é EXIGIDO: uma URL de outro dialeto
    // falha o boot em vez de conectar em um banco fora do padrão (§4.8). Antes, qualquer
    // prefixo desconhecido virava Postgres silenciosamente — foi assim que se conectou por
    // acidente no Postgres de produção durante a migração (ver comentário acima).
    db: dbUrl
      ? { type: exigirMariaDb(dbUrl), url: dbUrl }
      : {
          type: 'better-sqlite3',
          sqlitePath: process.env.MIGRACAO_DB_SQLITE ?? 'dados/painel.sqlite',
        },
    corsOrigins: (
      process.env.MIGRACAO_CORS_ORIGINS ?? 'http://localhost:4200'
    ).split(','),
    // Rate limit global por IP. O padrão (300 req/min) foi dimensionado pelo pior caso real
    // observado — abrir uma tela de BI dispara dezenas de chamadas em rajada —, com folga
    // para vários usuários atrás do mesmo IP de saída da rede interna. Ajustável por
    // ambiente sem redeploy; 0 no limite DESLIGA a proteção (só para diagnóstico).
    rateLimit: {
      ttlSegundos: Number(process.env.MIGRACAO_RATE_LIMIT_TTL ?? 60),
      limite: Number(process.env.MIGRACAO_RATE_LIMIT ?? 300),
    },
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
    // Pasta de operação: zips do dump do MariaDB (`painel_novo_mariadb_*.zip`, gerados por
    // tools/Painel_Novo_Backup_MariaDB.ps1) e os logs do backup e do Guardião. O painel só
    // LÊ daqui — é o que permite responder "o backup de ontem saiu?" sem abrir o servidor.
    backupDir: process.env.MIGRACAO_BACKUP_DIR ?? 'C:\\PainelBackups',
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
