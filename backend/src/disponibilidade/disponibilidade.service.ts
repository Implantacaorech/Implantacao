import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import oracledb from 'oracledb';

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

export interface LinhaOcupacao {
  tecnico: string;
  data: string;
  turno: '' | 'manha' | 'tarde';
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

// Espelha webapp/disponibilidade.py:SELECT_TECNICOS_PADRAO — casa o cadastro (código OU
// nome) com o NOME canônico do técnico no SICLA.
const SELECT_TECNICOS_PADRAO = 'SELECT CODIGO AS codigo, TECNICO AS tecnico FROM SICLA.TECNICOS';

const CACHE_TTL_MS = 180_000; // 180s — ver webapp/disponibilidade.py:_CACHE_TTL
const TEC_TTL_MS = 600_000; // 600s — ver webapp/disponibilidade.py:_TEC_TTL

/** Disponibilidade dos consultores via banco externo (Oracle/SICLA, configurável pelo
 * Administrador) + execução de SQL nomeado (Consultas BD/Dashboards) — mesma conexão.
 * Espelha webapp/disponibilidade.py. Só o dialeto Oracle (`oracledb`) é implementado de
 * verdade nesta fatia — os outros dialetos que o Flask suportava genericamente
 * (postgresql/mysql/sqlserver) nunca tiveram uso real neste sistema (só o SICLA, que é
 * Oracle); ver docs/migracao/03-documento-conversao.md. */
@Injectable()
export class DisponibilidadeService {
  private readonly logger = new Logger('DisponibilidadeService');
  private thickInicializado = false;

  private cacheOcupacao = new Map<string, { ts: number; valor: Record<string, boolean> }>();
  private cacheTecnicos: { ts: number; mapa: Record<string, string> } = { ts: 0, mapa: {} };

  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(process.cwd(), 'dados', `disponibilidade_test_${process.env.JEST_WORKER_ID ?? '0'}`)
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
        cfg = JSON.parse(readFileSync(this.arquivo(), 'utf8'));
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
    const m = /^[\w+]+:\/\/([^:@/]+)(?::([^@]*))?@([^/]+)\/(.*)$/.exec(url.trim());
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
    const host = cfg.porta.trim() ? `${cfg.host.trim()}:${cfg.porta.trim()}` : cfg.host.trim();
    return `${host}/${cfg.banco.trim()}`;
  }

  private credenciais(cfg: ConfigDisponibilidade): { usuario: string; senha: string } {
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
      oracledb.initOracleClient(cfg.oracleLibDir.trim() ? { libDir: cfg.oracleLibDir.trim() } : {});
    } catch (e) {
      if (!(e instanceof Error) || !e.message.toLowerCase().includes('already been initialized')) {
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
    const connection = await oracledb.getConnection({ user: usuario, password: senha, connectString });
    try {
      return await fn(connection);
    } finally {
      await connection.close().catch(() => {});
    }
  }

  /** True se o SELECT usa o filtro `:tecnicos` — então vale ampliar a janela de datas (a
   * consulta já vem restrita aos consultores envolvidos). */
  filtraPorTecnico(cfg?: ConfigDisponibilidade): boolean {
    const c = cfg ?? this.carregarConfig();
    return /:tecnicos\b/.test(c.select);
  }

  /** Substitui o token `:tecnicos` (contrato do SELECT: `... IN :tecnicos`) por uma lista
   * de binds nomeados `(:tecnicos_0, :tecnicos_1, ...)` — o node-oracledb não tem o
   * "expanding bindparam" do SQLAlchemy, que fazia essa mesma expansão nos bastidores.
   * Lista vazia vira `(NULL)` (nunca casa, mesmo efeito de um `IN` sem valores). */
  private expandirTecnicos(
    sql: string,
    tecnicos: string[],
  ): { sql: string; binds: Record<string, string> } {
    if (!/:tecnicos\b/.test(sql)) return { sql, binds: {} };
    const valores = tecnicos.map((t) => String(t).trim()).filter(Boolean);
    if (valores.length === 0) {
      return { sql: sql.replace(/:tecnicos\b/g, '(NULL)'), binds: {} };
    }
    const binds: Record<string, string> = {};
    const nomes = valores.map((v, i) => {
      const nome = `tecnicos_${i}`;
      binds[nome] = v;
      return nome;
    });
    const placeholder = `(${nomes.map((n) => `:${n}`).join(', ')})`;
    return { sql: sql.replace(/:tecnicos\b/g, placeholder), binds };
  }

  private normalizarLinha(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k.toLowerCase()] = v;
    return out;
  }

  /** Executa o SELECT configurado no intervalo (`:data_ini`/`:data_fim`) e, se o SELECT usar
   * `:tecnicos`, filtra pelos CÓDIGOS informados — devolve a ocupação normalizada. */
  async consultar(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
    cfg?: ConfigDisponibilidade,
  ): Promise<LinhaOcupacao[]> {
    const c = cfg ?? this.carregarConfig();
    const { sql, binds: bindsTecnicos } = this.expandirTecnicos(c.select, tecnicos ?? []);
    const binds = { data_ini: dataIni, data_fim: dataFim, ...bindsTecnicos };
    const rows = await this.comConexao(c, async (conn) => {
      const r = await conn.execute<Record<string, unknown>>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return r.rows ?? [];
    });
    return rows.map((row) => {
      const d = this.normalizarLinha(row);
      const turno = String(d.turno ?? '').trim().toLowerCase();
      return {
        tecnico: String(d.tecnico ?? '').trim(),
        data: String(d.data ?? '').trim().slice(0, 10),
        turno: turno === 'manha' || turno === 'tarde' ? turno : '',
      };
    });
  }

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
    if (!sql) return { ok: false, mensagem: 'Consulta vazia.', colunas: [], linhas: [] };
    const inicio = this.semComentariosIniciais(sql).replace(/^\(/, '').toUpperCase();
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
        return { colunas: (r.metaData ?? []).map((m) => m.name), linhas: r.rows ?? [] };
      });
      return { ok: true, mensagem: `${linhas.length} linha(s).`, colunas, linhas };
    } catch (e) {
      return { ok: false, mensagem: this.mensagemErro(e), colunas: [], linhas: [] };
    }
  }

  /** Testa conexão+consulta numa janela de 30 dias. */
  async testar(
    cfg?: ConfigDisponibilidade,
  ): Promise<{ ok: boolean; mensagem: string; amostra: LinhaOcupacao[] }> {
    const c = cfg ?? this.carregarConfig();
    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setDate(fim.getDate() + 30);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    try {
      const linhas = await this.consultar(iso(hoje), iso(fim), undefined, c);
      return {
        ok: true,
        mensagem: `Conexão OK — ${linhas.length} compromisso(s) no período de teste.`,
        amostra: linhas.slice(0, 8),
      };
    } catch (e) {
      return { ok: false, mensagem: this.mensagemErro(e), amostra: [] };
    }
  }

  private mensagemErro(e: unknown): string {
    const texto = e instanceof Error ? e.message : String(e);
    if (texto.includes('DPY-3015') || texto.includes('ORA-28040')) {
      return (
        'Senha Oracle com verificador antigo (não aceito no modo thin). Marque \'Modo ' +
        "thick' na aba Disponibilidade e informe a pasta do client, OU peça ao DBA para " +
        'redefinir a senha com verificador 11g/12c.'
      );
    }
    if (texto.includes('DPI-1047') || texto.includes('NJS-045') || /\b126\b/.test(texto)) {
      return (
        'Não consegui carregar o Oracle Instant Client (modo thick) — veja a aba ' +
        'Disponibilidade para os detalhes de configuração.'
      );
    }
    return `${e instanceof Error ? e.constructor.name : 'Erro'}: ${texto.slice(0, 300)}`;
  }

  /** `{chaveLower: NOME canônico do técnico}`, resolvendo tanto o CÓDIGO numérico quanto o
   * próprio nome. Cache de 600s — {} se indisponível (o painel usa o valor do cadastro como
   * está). */
  async mapaTecnicos(cfg?: ConfigDisponibilidade): Promise<Record<string, string>> {
    const c = cfg ?? this.carregarConfig();
    if (this.cacheTecnicos.mapa && Date.now() - this.cacheTecnicos.ts < TEC_TTL_MS) {
      if (Object.keys(this.cacheTecnicos.mapa).length > 0) return this.cacheTecnicos.mapa;
    }
    const query = (c.selectTecnicos || SELECT_TECNICOS_PADRAO).trim();
    const mapa: Record<string, string> = {};
    try {
      const rows = await this.comConexao(c, async (conn) => {
        const r = await conn.execute<Record<string, unknown>>(query, [], {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        return r.rows ?? [];
      });
      for (const row of rows) {
        const d = this.normalizarLinha(row);
        const nome = String(d.tecnico ?? '').trim();
        const cod = String(d.codigo ?? '').trim();
        if (!nome) continue;
        mapa[nome.toLowerCase()] = nome;
        if (cod) mapa[cod.toLowerCase()] = nome;
      }
      this.cacheTecnicos = { ts: Date.now(), mapa };
    } catch (e) {
      this.logger.error(
        'Falha ao montar o mapa de técnicos do SICLA (código<->nome)',
        e instanceof Error ? e.stack : String(e),
      );
    }
    return mapa;
  }

  /** `{chaveLower|data|turno: true}` dos compromissos, sem cache — use na validação final de
   * alocação. Aceita em `tecnicos` o CÓDIGO numérico OU o nome: traduz para o nome antes de
   * consultar (o SELECT casa por nome) e re-indexa o resultado TAMBÉM pela chave original. */
  async ocupacaoPorSlot(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
    cfg?: ConfigDisponibilidade,
  ): Promise<Record<string, boolean>> {
    const c = cfg ?? this.carregarConfig();
    const entradas = (tecnicos ?? []).map((t) => String(t).trim()).filter(Boolean);
    const mapa = entradas.length > 0 ? await this.mapaTecnicos(c) : {};
    const nomes: string[] = [];
    const alias = new Map<string, Set<string>>();
    for (const e of entradas) {
      const nome = mapa[e.toLowerCase()] ?? e;
      nomes.push(nome);
      const chave = nome.trim().toLowerCase();
      if (!alias.has(chave)) alias.set(chave, new Set());
      alias.get(chave)!.add(e.toLowerCase());
    }
    const ocup: Record<string, boolean> = {};
    const linhas = await this.consultar(dataIni, dataFim, nomes.length > 0 ? nomes : undefined, c);
    for (const r of linhas) {
      const tec = r.tecnico.trim().toLowerCase();
      if (!tec || !r.data) continue;
      const chaves = new Set([tec, ...(alias.get(tec) ?? [])]);
      const turnos: ('manha' | 'tarde')[] = r.turno ? [r.turno] : ['manha', 'tarde'];
      for (const turno of turnos) {
        for (const k of chaves) ocup[`${k}|${r.data}|${turno}`] = true;
      }
    }
    return ocup;
  }

  /** Como `ocupacaoPorSlot`, com cache de 180s por (janela, técnicos) — use nas TELAS
   * (navegação rápida); a validação final de alocação usa a direta. */
  async ocupacaoPorSlotCache(
    dataIni: string,
    dataFim: string,
    tecnicos?: string[],
    cfg?: ConfigDisponibilidade,
  ): Promise<Record<string, boolean>> {
    const chave = JSON.stringify([
      dataIni,
      dataFim,
      [...(tecnicos ?? [])].map((t) => String(t).trim().toLowerCase()).sort(),
    ]);
    const hit = this.cacheOcupacao.get(chave);
    const agora = Date.now();
    if (hit && agora - hit.ts < CACHE_TTL_MS) return hit.valor;
    const ocup = await this.ocupacaoPorSlot(dataIni, dataFim, tecnicos, cfg);
    this.cacheOcupacao.set(chave, { ts: agora, valor: ocup });
    if (this.cacheOcupacao.size > 64) {
      const entradas = [...this.cacheOcupacao.entries()].sort((a, b) => a[1].ts - b[1].ts);
      for (const [k] of entradas.slice(0, 32)) this.cacheOcupacao.delete(k);
    }
    return ocup;
  }
}
