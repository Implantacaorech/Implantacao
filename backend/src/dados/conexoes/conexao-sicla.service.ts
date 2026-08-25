import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';

/** ================================================================================
 *  CONEXÃO SICLA (Oracle) — o driver mora AQUI, e só aqui (fase 2 do ADR-0003).
 *
 *  Este arquivo concentra tudo que sabe falar Oracle: credenciais, string de conexão, modo
 *  thick, teto de tempo por round-trip, tradução de erro e a execução em si. Nenhum módulo
 *  do Painel o injeta — quem consulta o SICLA pede a consulta pelo NOME ao `DadosService`,
 *  que chega até aqui pelo `ConexoesService`.
 *
 *  Veio inteiro de `disponibilidade/disponibilidade.service.ts`, que ficou só com o DOMÍNIO
 *  (ocupação dos consultores, mapa de técnicos) — a mudança de casa é o que fecha a
 *  fronteira: antes, qualquer service podia injetar a Disponibilidade e rodar SQL.
 *  ================================================================================ */

// CLOB chega como TEXTO, não como stream/Lob: sem isto, uma coluna CLOB (ex.: o
// DETALHAMENTO de LISTA_ITEMPED na consulta da tela RNS) viraria um objeto Lob que a
// serialização JSON transforma em `{}` — o dado sumiria em silêncio na tela e no
// Consultas BD. `maxRows` continua limitando o volume por consulta.
oracledb.fetchAsString = [oracledb.CLOB];

export interface ConfigDisponibilidade {
  tipo: string;
  host: string;
  porta: string;
  banco: string;
  usuario: string;
  senha: string;
  url: string;
  select: string;
  selectTecnicos: string;
  oracleLibDir: string;
  ativo: boolean;
  oracleThick: boolean;
}
export interface ResultadoExecucao {
  ok: boolean;
  mensagem: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
}

/** Valores aceitos como bind (subconjunto do `oracledb.BindParameters` — só os tipos que
 * este serviço realmente usa: string/data). */
export type BindsSql = Record<string, string | number | null | undefined>;
const CAMPOS_TEXTO: (keyof ConfigDisponibilidade)[] = [
  'tipo',
  'host',
  'porta',
  'banco',
  'usuario',
  'url',
  'select',
  'selectTecnicos',
  'oracleLibDir',
];

// A14: teto por round-trip da conexão Oracle (callTimeout). 15s é folgado para uma consulta
// de agenda e curto o bastante para não pendurar o handler HTTP num banco lento.
const TIMEOUT_ORACLE_MS = 15_000;
@Injectable()
export class ConexaoSiclaService {
  private readonly logger = new Logger('ConexaoSiclaService');
  private thickInicializado = false;
  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `disponibilidade_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivo(): string {
    return join(this.dir(), 'disponibilidade.json');
  }

  carregarConfig(): ConfigDisponibilidade {
    let cfg: Partial<ConfigDisponibilidade> = {};
    if (existsSync(this.arquivo())) {
      try {
        cfg = JSON.parse(
          readFileSync(this.arquivo(), 'utf8'),
        ) as Partial<ConfigDisponibilidade>;
      } catch {
        cfg = {};
      }
    }
    return {
      tipo: cfg.tipo ?? '',
      host: cfg.host ?? '',
      porta: cfg.porta ?? '',
      banco: cfg.banco ?? '',
      usuario: cfg.usuario ?? '',
      senha: cfg.senha ?? '',
      url: cfg.url ?? '',
      select: cfg.select ?? '',
      selectTecnicos: cfg.selectTecnicos ?? '',
      oracleLibDir: cfg.oracleLibDir ?? '',
      ativo: cfg.ativo ?? false,
      oracleThick: cfg.oracleThick ?? false,
    };
  }

  /** A senha não é apagada se vier em branco (mesma regra do Flask original). */
  salvarConfig(dados: Partial<ConfigDisponibilidade>): ConfigDisponibilidade {
    const atual = this.carregarConfig();
    const cfg: ConfigDisponibilidade = { ...atual };
    // Object.assign em vez de atribuição indexada dentro do loop — TS não estreita bem a
    // atribuição via uma união de chaves vinda de um array `keyof[]`, mesmo sendo todas
    // string em ConfigDisponibilidade (garantido pelo tipo do próprio array acima).
    const camposEditados: Record<string, string> = {};
    for (const campo of CAMPOS_TEXTO) {
      camposEditados[campo] = ((dados[campo] as string) ?? '').trim();
    }
    Object.assign(cfg, camposEditados);
    cfg.ativo = Boolean(dados.ativo);
    cfg.oracleThick = Boolean(dados.oracleThick);
    const senha = (dados.senha ?? '').trim();
    if (senha) cfg.senha = senha;
    writeFileSync(this.arquivo(), JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  /** SQL guardado na CONFIGURAÇÃO da conexão (tela Disponibilidade), não em código nem em
   * Consultas BD — é a terceira origem de SQL do sistema, e a única em que o texto viaja
   * junto das credenciais. Devolve o texto CRU: quem decide o fallback é o catálogo, pela
   * origem `config_conexao` (é lá que a semente mora, junto do resto do SQL). */
  sqlDeConfiguracao(campo: 'select' | 'selectTecnicos'): string {
    return (this.carregarConfig()[campo] || '').trim();
  }

  configurado(cfg?: ConfigDisponibilidade): boolean {
    const c = cfg ?? this.carregarConfig();
    return Boolean(c.ativo && c.select.trim() && this.stringConexao(c));
  }

  /** Extrai `{usuario, senha, connectString}` de uma URL completa colada pelo admin (mesmo
   * formato do Flask: `oracle+oracledb://usuario:senha@host:porta/banco`) — aceito por
   * compatibilidade com uma config migrada do painel Flask. */
  private parsearUrl(
    url: string,
  ): { usuario: string; senha: string; connectString: string } | null {
    const m = /^[\w+]+:\/\/([^:@/]+)(?::([^@]*))?@([^/]+)\/(.*)$/.exec(
      url.trim(),
    );
    if (!m) return null;
    return {
      usuario: decodeURIComponent(m[1]),
      senha: m[2] ? decodeURIComponent(m[2]) : '',
      connectString: `${m[3]}/${m[4]}`,
    };
  }

  private stringConexao(cfg: ConfigDisponibilidade): string {
    if (cfg.url.trim()) {
      const p = this.parsearUrl(cfg.url);
      return p?.connectString ?? '';
    }
    if (!cfg.host.trim()) return '';
    const host = cfg.porta.trim()
      ? `${cfg.host.trim()}:${cfg.porta.trim()}`
      : cfg.host.trim();
    return `${host}/${cfg.banco.trim()}`;
  }

  private credenciais(cfg: ConfigDisponibilidade): {
    usuario: string;
    senha: string;
  } {
    if (cfg.url.trim()) {
      const p = this.parsearUrl(cfg.url);
      if (p) return { usuario: p.usuario, senha: p.senha };
    }
    return { usuario: cfg.usuario, senha: cfg.senha };
  }

  /** Habilita o modo thick do oracledb (Oracle Instant Client) quando pedido — necessário
   * para senhas com verificador antigo. Roda uma vez por processo. */
  private talvezThick(cfg: ConfigDisponibilidade): void {
    if (this.thickInicializado || !cfg.oracleThick) return;
    try {
      oracledb.initOracleClient(
        cfg.oracleLibDir.trim() ? { libDir: cfg.oracleLibDir.trim() } : {},
      );
    } catch (e) {
      if (
        !(e instanceof Error) ||
        !e.message.toLowerCase().includes('already been initialized')
      ) {
        throw e;
      }
    }
    this.thickInicializado = true;
  }

  private async comConexao<T>(
    cfg: ConfigDisponibilidade,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const connectString = this.stringConexao(cfg);
    if (!connectString) {
      throw new Error('Conexão não configurada (informe os campos ou a URL).');
    }
    this.talvezThick(cfg);
    const { usuario, senha } = this.credenciais(cfg);
    const connection = await oracledb.getConnection({
      user: usuario,
      password: senha,
      connectString,
    });
    // A14: teto de tempo por round-trip. O SELECT é EDITÁVEL pelo Administrador; sem isto,
    // uma consulta pesada ou o banco lento penduravam o handler HTTP até o TCP morrer.
    // `callTimeout` aborta qualquer `execute()` que passe do limite (a base já teria fechado
    // a conexão de outra forma). A abertura da conexão é limitada pelo TCP do SO.
    connection.callTimeout = TIMEOUT_ORACLE_MS;
    try {
      return await fn(connection);
    } finally {
      await connection.close().catch(() => {});
    }
  }

  /** Substitui o token `:tecnicos` (contrato do SELECT: `... IN :tecnicos`) por uma lista
   * de binds nomeados `(:tecnicos_0, :tecnicos_1, ...)` — o node-oracledb não tem o
   * "expanding bindparam" do SQLAlchemy, que fazia essa mesma expansão nos bastidores.
   * Lista vazia vira `(NULL)` (nunca casa, mesmo efeito de um `IN` sem valores). */
  /** Pula comentários de linha (--) e de bloco (/* *\/) do INÍCIO do texto — só para decidir
   * se é um SELECT/WITH válido; o SQL executado continua sendo o original. */
  private semComentariosIniciais(sql: string): string {
    let s = sql;
    for (;;) {
      const s2 = s.replace(/^\s+/, '');
      if (s2.startsWith('--')) {
        const nl = s2.indexOf('\n');
        s = nl !== -1 ? s2.slice(nl + 1) : '';
      } else if (s2.startsWith('/*')) {
        const fim = s2.indexOf('*/');
        s = fim !== -1 ? s2.slice(fim + 2) : '';
      } else {
        return s2;
      }
    }
  }
  /** Roda um SQL arbitrário (SELECT) contra a MESMA conexão configurada para a
   * Disponibilidade — usado pelas Consultas BD/Dashboards. Só aceita SELECT/WITH (proteção
   * mínima contra colar um comando destrutivo por engano — quem edita já é Administrador). */
  async executarSql(
    sqlBruto: string,
    params: BindsSql = {},
    cfg?: ConfigDisponibilidade,
    limite = 500,
  ): Promise<ResultadoExecucao> {
    const c = cfg ?? this.carregarConfig();
    const sql = (sqlBruto || '').trim();
    if (!sql)
      return {
        ok: false,
        mensagem: 'Consulta vazia.',
        colunas: [],
        linhas: [],
      };
    const inicio = this.semComentariosIniciais(sql)
      .replace(/^\(/, '')
      .toUpperCase();
    if (!(inicio.startsWith('SELECT') || inicio.startsWith('WITH'))) {
      return {
        ok: false,
        mensagem: 'Só é permitido rodar comandos SELECT (ou WITH ... SELECT).',
        colunas: [],
        linhas: [],
      };
    }
    try {
      const { colunas, linhas } = await this.comConexao(c, async (conn) => {
        const r = await conn.execute<Record<string, unknown>>(sql, params, {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          maxRows: limite,
        });
        return {
          colunas: (r.metaData ?? []).map((m) => m.name),
          linhas: r.rows ?? [],
        };
      });
      return {
        ok: true,
        mensagem: `${linhas.length} linha(s).`,
        colunas,
        linhas,
      };
    } catch (e) {
      return {
        ok: false,
        mensagem: this.mensagemErro(e),
        colunas: [],
        linhas: [],
      };
    }
  }

  private mensagemErro(e: unknown): string {
    const texto = e instanceof Error ? e.message : String(e);
    if (texto.includes('DPY-3015') || texto.includes('ORA-28040')) {
      return (
        "Senha Oracle com verificador antigo (não aceito no modo thin). Marque 'Modo " +
        "thick' na aba Disponibilidade e informe a pasta do client, OU peça ao DBA para " +
        'redefinir a senha com verificador 11g/12c.'
      );
    }
    if (
      texto.includes('DPI-1047') ||
      texto.includes('NJS-045') ||
      /\b126\b/.test(texto)
    ) {
      return (
        'Não consegui carregar o Oracle Instant Client (modo thick) — veja a aba ' +
        'Disponibilidade para os detalhes de configuração.'
      );
    }
    return `${e instanceof Error ? e.constructor.name : 'Erro'}: ${texto.slice(0, 300)}`;
  }
}
