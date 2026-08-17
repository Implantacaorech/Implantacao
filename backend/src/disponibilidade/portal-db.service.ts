import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createConnection } from 'mysql2/promise';
import type { ResultadoExecucao } from './disponibilidade.service';

/** Conexão com o BANCO DO PORTAL RECH (MySQL/MariaDB), cadastrada pelo Administrador em
 * Sistema → Consulta BD. É a segunda conexão externa do Painel (a primeira é o Oracle do
 * SICLA, na Disponibilidade) — nasceu para o painel "Visitas do Portal Rech" do BI: o dado
 * de protocolo/aprovação só existe no banco do Portal (o SICLA não o espelha e a API do
 * Portal é escopada por usuário — o painel precisa de TODOS os protocolos do cliente). */
export interface ConfigPortalDb {
  host: string;
  porta: string;
  banco: string;
  usuario: string;
  senha: string;
  /** URL completa alternativa (`mysql://usuario:senha@host:porta/banco`) — prevalece. */
  url: string;
  ativo: boolean;
}

const CAMPOS_TEXTO: (keyof ConfigPortalDb)[] = [
  'host',
  'porta',
  'banco',
  'usuario',
  'url',
];

/** Teto de tempo da conexão/consulta — o banco do Portal está em outra rede; sem teto,
 * um roteamento quebrado penduraria o handler HTTP (mesma razão do callTimeout Oracle). */
const TIMEOUT_MS = 15_000;

/** Segredo-em-repouso em `dados/portal_db.json` — mesmo padrão de `disponibilidade.json`
 * e `portal_credenciais.json` (rede interna, arquivo fora do git, senha nunca volta ao
 * navegador; senha em branco na edição MANTÉM a atual). */
@Injectable()
export class PortalDbService {
  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `portal_db_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivo(): string {
    return join(this.dir(), 'portal_db.json');
  }

  carregarConfig(): ConfigPortalDb {
    let cfg: Partial<ConfigPortalDb> = {};
    if (existsSync(this.arquivo())) {
      try {
        cfg = JSON.parse(
          readFileSync(this.arquivo(), 'utf8'),
        ) as Partial<ConfigPortalDb>;
      } catch {
        cfg = {};
      }
    }
    return {
      host: cfg.host ?? '',
      porta: cfg.porta ?? '',
      banco: cfg.banco ?? '',
      usuario: cfg.usuario ?? '',
      senha: cfg.senha ?? '',
      url: cfg.url ?? '',
      ativo: cfg.ativo ?? false,
    };
  }

  salvarConfig(dados: Partial<ConfigPortalDb>): ConfigPortalDb {
    const cfg = this.carregarConfig();
    // Object.assign em vez de atribuição indexada — mesma razão do DisponibilidadeService:
    // o TS não estreita a união de chaves vinda de um `keyof[]`, mesmo sendo todas string.
    const camposEditados: Record<string, string> = {};
    for (const campo of CAMPOS_TEXTO) {
      camposEditados[campo] = ((dados[campo] as string) ?? '').trim();
    }
    Object.assign(cfg, camposEditados);
    cfg.ativo = Boolean(dados.ativo);
    const senha = (dados.senha ?? '').trim();
    if (senha) cfg.senha = senha;
    writeFileSync(this.arquivo(), JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  configurado(cfg?: ConfigPortalDb): boolean {
    const c = cfg ?? this.carregarConfig();
    return Boolean(c.ativo && (c.url.trim() || (c.host.trim() && c.banco.trim())));
  }

  /** `mysql://usuario:senha@host:porta/banco` → partes (mesma regra da Disponibilidade). */
  private parsearUrl(
    url: string,
  ): { usuario: string; senha: string; host: string; porta: string; banco: string } | null {
    const m = /^[\w+]+:\/\/([^:@/]+)(?::([^@]*))?@([^:/]+)(?::(\d+))?\/(.*)$/.exec(
      url.trim(),
    );
    if (!m) return null;
    return {
      usuario: decodeURIComponent(m[1]),
      senha: m[2] ? decodeURIComponent(m[2]) : '',
      host: m[3],
      porta: m[4] ?? '',
      banco: m[5],
    };
  }

  private opcoesConexao(cfg: ConfigPortalDb): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  } {
    const p = cfg.url.trim() ? this.parsearUrl(cfg.url) : null;
    const host = p?.host ?? cfg.host.trim();
    const porta = Number(p?.porta || cfg.porta.trim() || 3306);
    return {
      host,
      port: Number.isFinite(porta) && porta > 0 ? porta : 3306,
      user: p?.usuario ?? cfg.usuario.trim(),
      password: p?.senha || cfg.senha,
      database: p?.banco ?? cfg.banco.trim(),
    };
  }

  /** Pula comentários de linha/bloco do INÍCIO — só para validar que é SELECT/WITH (o SQL
   * executado é o original). Mesma regra da Disponibilidade. */
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

  /** Roda um SELECT no banco do Portal com binds NOMEADOS (`:data_ini` — mysql2
   * `namedPlaceholders`). `dateStrings` mantém DATE/TIME como texto (`AAAA-MM-DD`/
   * `HH:MM:SS`), o formato-contrato das telas. Devolve o MESMO shape do executor Oracle
   * (`ResultadoExecucao`) para as telas não distinguirem a origem. */
  async executarSql(
    sqlBruto: string,
    params: Record<string, string | number | null> = {},
    limite = 20000,
  ): Promise<ResultadoExecucao> {
    const cfg = this.carregarConfig();
    const sql = (sqlBruto || '').trim();
    if (!sql) {
      return { ok: false, mensagem: 'Consulta vazia.', colunas: [], linhas: [] };
    }
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
    if (!this.configurado(cfg)) {
      return {
        ok: false,
        mensagem:
          'Conexão com o banco do Portal Rech não configurada ou inativa (Sistema → Consulta BD).',
        colunas: [],
        linhas: [],
      };
    }
    let conn: Awaited<ReturnType<typeof createConnection>> | null = null;
    try {
      conn = await createConnection({
        ...this.opcoesConexao(cfg),
        namedPlaceholders: true,
        dateStrings: true,
        connectTimeout: TIMEOUT_MS,
      });
      const [rows] = await conn.execute({ sql, timeout: TIMEOUT_MS }, params);
      const todas = Array.isArray(rows)
        ? (rows as Record<string, unknown>[])
        : [];
      const linhas = todas.slice(0, limite);
      const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : [];
      return { ok: true, mensagem: `${linhas.length} linha(s).`, colunas, linhas };
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        mensagem: `Banco do Portal Rech: ${texto.slice(0, 300)}`,
        colunas: [],
        linhas: [],
      };
    } finally {
      await conn?.end().catch(() => {});
    }
  }

  /** Testa a conexão cadastrada com um SELECT 1. */
  async testar(): Promise<{ ok: boolean; mensagem: string }> {
    if (!this.configurado()) {
      return {
        ok: false,
        mensagem: 'Preencha e ative a conexão antes de testar.',
      };
    }
    const r = await this.executarSql('SELECT 1 AS OK', {}, 1);
    return r.ok
      ? { ok: true, mensagem: 'Conexão com o banco do Portal Rech OK.' }
      : { ok: false, mensagem: r.mensagem };
  }
}
