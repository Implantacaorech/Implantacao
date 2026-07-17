import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface ConfigImap {
  host: string;
  port: string;
  user: string;
  senha: string;
  pasta: string;
}

const MARCADOR_PADRAO = 'IMPLANTA';

/** Leitura da caixa de entrada (IMAP) para detectar o e-mail de fechamento. Espelha
 * webapp/imap_intake.py. Config local em `dados/imap.json` (gitignored) ou env
 * `MIGRACAO_IMAP_*`. */
@Injectable()
export class ImapIntakeService {
  private readonly logger = new Logger('ImapIntakeService');

  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(process.cwd(), 'dados', `email_test_${process.env.JEST_WORKER_ID ?? '0'}`)
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivo(): string {
    return join(this.dir(), 'imap.json');
  }

  carregarConfig(): ConfigImap {
    let cfg: Partial<ConfigImap> = {};
    if (existsSync(this.arquivo())) {
      try {
        cfg = JSON.parse(readFileSync(this.arquivo(), 'utf8'));
      } catch {
        cfg = {};
      }
    }
    const env: Partial<Record<keyof ConfigImap, string | undefined>> = {
      host: process.env.MIGRACAO_IMAP_HOST,
      port: process.env.MIGRACAO_IMAP_PORT,
      user: process.env.MIGRACAO_IMAP_USER,
      senha: process.env.MIGRACAO_IMAP_PASS,
      pasta: process.env.MIGRACAO_IMAP_FOLDER,
    };
    for (const [k, v] of Object.entries(env)) {
      if (v) (cfg as Record<string, string>)[k] = v;
    }
    return {
      host: cfg.host ?? '',
      port: cfg.port ?? '993',
      user: cfg.user ?? '',
      senha: cfg.senha ?? '',
      pasta: cfg.pasta ?? 'INBOX',
    };
  }

  salvarConfig(dados: { host?: string; port?: string; user?: string; pasta?: string; senha?: string }): ConfigImap {
    const senha = (dados.senha || '').trim();
    const cfg: ConfigImap = {
      host: (dados.host || '').trim(),
      port: (dados.port || '').trim() || '993',
      user: (dados.user || '').trim(),
      pasta: (dados.pasta || '').trim() || 'INBOX',
      senha: senha || this.carregarConfig().senha,
    };
    writeFileSync(this.arquivo(), JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  configurado(): boolean {
    const c = this.carregarConfig();
    return Boolean(c.host && c.user);
  }

  private async conectar(cfg: ConfigImap): Promise<ImapFlow> {
    const client = new ImapFlow({
      host: cfg.host,
      port: Number(cfg.port) || 993,
      secure: true,
      auth: { user: cfg.user, pass: cfg.senha },
      logger: false,
    });
    // ImapFlow é um EventEmitter; sem um listener de 'error', um problema assíncrono no
    // socket (ex.: timeout de conexão) vira uma exceção não tratada que derruba o
    // processo Node INTEIRO — não é pego pelo try/catch de processarFechamentos()/
    // buscarFechamento() porque o evento pode disparar fora da promise que eles esperam
    // (achado real: crash a cada poll do robô da caixa, ETIMEOUT em imap-flow.js, log em
    // C:\PainelBackups\painel_novo_stdout.log). Logar aqui converte isso numa falha
    // tratada (a operação em curso já tem seu próprio catch) em vez de fatal.
    client.on('error', (e: unknown) => {
      this.logger.warn(
        'Erro assíncrono na conexão IMAP (socket) — ignorado para não derrubar o processo',
        e instanceof Error ? e.message : String(e),
      );
    });
    await client.connect();
    return client;
  }

  private erroAmigavel(e: unknown, host: string): string {
    const codigo = (e as NodeJS.ErrnoException)?.code;
    const texto = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
      return (
        `Servidor IMAP não encontrado (${host}). Confira o host em Config → Caixa de ` +
        'entrada — ex.: imap.gmail.com ou outlook.office365.com.'
      );
    }
    if (texto.toLowerCase().includes('authenticate') || texto.toLowerCase().includes('login')) {
      return (
        'Falha de autenticação (usuário/senha rejeitados). Gmail e Outlook/365 exigem ' +
        'uma SENHA DE APP (não a senha normal da conta) e o IMAP habilitado. Confira o ' +
        'usuário e a senha em Config → Caixa de entrada.'
      );
    }
    return texto;
  }

  /** Para cada e-mail NÃO LIDO cujo assunto contém `marcador`, chama `criarFn(corpo,
   * assunto)` e o marca como lido (só se `criarFn` não lançar — falha deixa não lido
   * para nova tentativa na próxima varredura). Devolve quantos foram processados. Usado
   * pelo robô (`RoboCaixaService`). */
  async processarFechamentos(
    criarFn: (corpo: string, assunto: string) => Promise<void>,
    marcador = MARCADOR_PADRAO,
  ): Promise<number> {
    const cfg = this.carregarConfig();
    if (!cfg.host) return 0;
    let n = 0;
    let client: ImapFlow | undefined;
    try {
      client = await this.conectar(cfg);
      const lock = await client.getMailboxLock(cfg.pasta);
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of uids) {
          const cab = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          const assunto = cab && cab.envelope ? cab.envelope.subject || '' : '';
          if (!assunto.toLowerCase().includes(marcador.toLowerCase())) continue;
          const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!full || !full.source) continue;
          const parsed = await simpleParser(full.source);
          try {
            await criarFn(parsed.text || '', assunto);
            await client.messageFlagsAdd({ uid: String(uid) }, ['\\Seen'], { uid: true });
            n += 1;
          } catch (e) {
            this.logger.warn(`criarFn falhou para uid=${uid} — deixado não lido`, e instanceof Error ? e.message : String(e));
          }
        }
      } finally {
        lock.release();
      }
    } catch {
      return n;
    } finally {
      if (client) await client.logout().catch(() => {});
    }
    return n;
  }

  /** Devolve (corpo, assunto) do último e-mail NÃO LIDO cujo assunto contém `marcador` —
   * usado pelo botão manual "Verificar caixa". NÃO marca como lido. */
  async buscarFechamento(
    marcador = MARCADOR_PADRAO,
  ): Promise<{ corpo: string | null; assunto: string | null; erro: string | null }> {
    const cfg = this.carregarConfig();
    if (!cfg.host) {
      return { corpo: null, assunto: null, erro: 'IMAP não configurado (Config → Caixa de entrada).' };
    }
    let client: ImapFlow | undefined;
    try {
      client = await this.conectar(cfg);
      const lock = await client.getMailboxLock(cfg.pasta);
      try {
        const uids = ((await client.search({ seen: false }, { uid: true })) || []).slice().reverse();
        for (const uid of uids) {
          const cab = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          const assunto = cab && cab.envelope ? cab.envelope.subject || '' : '';
          if (!assunto.toLowerCase().includes(marcador.toLowerCase())) continue;
          const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!full || !full.source) continue;
          const parsed = await simpleParser(full.source);
          return { corpo: parsed.text || '', assunto, erro: null };
        }
        return { corpo: null, assunto: null, erro: 'Nenhum e-mail de fechamento novo encontrado.' };
      } finally {
        lock.release();
      }
    } catch (e) {
      return { corpo: null, assunto: null, erro: this.erroAmigavel(e, cfg.host) };
    } finally {
      if (client) await client.logout().catch(() => {});
    }
  }
}
