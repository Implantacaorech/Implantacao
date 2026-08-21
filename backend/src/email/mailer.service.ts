import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as nodemailer from 'nodemailer';
import { GraphService } from './graph.service';
import { ResultadoEnvio } from './resultado-envio';
import { Anexo } from './anexo';

export interface ConfigSmtp {
  host: string;
  port: string;
  user: string;
  senha: string;
  remetente: string;
  useTls: boolean;
}

/** E-mail interno do Painel: configuração local + envio, escolhendo o meio disponível.
 *
 * O caminho oficial é o **Microsoft Graph** (`GraphService`), a caixa da Rech; o SMTP daqui
 * é o alternativo, para o caso de o TI entregar um relay interno em vez do registro de
 * aplicativo — com o usuário em branco, o envio sai sem autenticação, que é como um relay
 * liberado por IP funciona. O primeiro meio configurado ganha, e quem chama `enviar` não
 * precisa saber qual foi.
 *
 * O envio pela API do **Gmail** existiu aqui até 2026-08-17, como saída para o SMTP
 * bloqueado na rede; saiu do projeto quando a caixa passou a ser Microsoft (ver histórico
 * do git se precisar do fluxo OAuth delegado que ele usava).
 *
 * A senha fica só na máquina (`dados/smtp.json`) — nunca versionada nem no banco; variáveis
 * de ambiente `MIGRACAO_SMTP_*` têm prioridade sobre o arquivo. Espelha webapp/mailer.py —
 * `templates()` (os 3 modelos hardcoded) não foi portado: está morto no Flask original,
 * substituído pelo `ModeloEmail` (ver ModeloEmailService). */
@Injectable()
export class MailerService {
  constructor(private readonly graph: GraphService) {}

  private arquivo(): string {
    const dir =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(dir, { recursive: true });
    return join(dir, 'smtp.json');
  }

  carregarConfig(): ConfigSmtp {
    let cfg: Partial<ConfigSmtp> = {};
    if (existsSync(this.arquivo())) {
      try {
        cfg = JSON.parse(
          readFileSync(this.arquivo(), 'utf8'),
        ) as Partial<ConfigSmtp>;
      } catch {
        cfg = {};
      }
    }
    const env: Partial<Record<keyof ConfigSmtp, string | undefined>> = {
      host: process.env.MIGRACAO_SMTP_HOST,
      port: process.env.MIGRACAO_SMTP_PORT,
      user: process.env.MIGRACAO_SMTP_USER,
      senha: process.env.MIGRACAO_SMTP_PASS,
      remetente: process.env.MIGRACAO_SMTP_FROM,
    };
    for (const [k, v] of Object.entries(env)) {
      if (v) (cfg as Record<string, string>)[k] = v;
    }
    if (process.env.MIGRACAO_SMTP_TLS)
      cfg.useTls = process.env.MIGRACAO_SMTP_TLS === 'true';
    return {
      host: cfg.host ?? '',
      port: cfg.port ?? '587',
      user: cfg.user ?? '',
      senha: cfg.senha ?? '',
      remetente: cfg.remetente ?? '',
      useTls: cfg.useTls ?? false,
    };
  }

  salvarConfig(dados: {
    host?: string;
    port?: string;
    user?: string;
    remetente?: string;
    useTls?: boolean;
    senha?: string;
  }): ConfigSmtp {
    // replace, não só trim: senha de app costuma ser colada com os espaços internos com que
    // é exibida — mesmo achado de imap-intake.service.ts.
    const senha = (dados.senha || '').replace(/\s+/g, '');
    const cfg: ConfigSmtp = {
      host: (dados.host || '').trim(),
      port: (dados.port || '').trim() || '587',
      user: (dados.user || '').trim(),
      remetente: (dados.remetente || '').trim(),
      useTls: Boolean(dados.useTls),
      // não apaga a senha ao reeditar sem preencher de novo
      senha: senha || this.carregarConfig().senha,
    };
    writeFileSync(this.arquivo(), JSON.stringify(cfg, null, 2), 'utf8');
    return cfg;
  }

  configurado(): boolean {
    if (this.graph.configurado()) return true;
    const c = this.carregarConfig();
    return Boolean(c.host && c.remetente);
  }

  /** Envia um e-mail de texto, com anexos opcionais. `destino` pode ser string (1 ou
   * vários separados por vírgula) ou lista. Usa o Microsoft Graph quando configurado
   * (HTTPS); senão, SMTP. */
  async enviar(
    destino: string | string[],
    assunto: string,
    corpo: string,
    anexos: Anexo[] = [],
  ): Promise<ResultadoEnvio> {
    if (this.graph.configurado()) {
      return this.graph.enviar(destino, assunto, corpo, anexos);
    }
    const c = this.carregarConfig();
    if (!c.host) {
      return {
        ok: false,
        erro:
          'Nenhum meio de envio configurado — configure o Microsoft 365 em Config → ' +
          'E-mail (Microsoft 365) ou o SMTP em Config → E-mail.',
      };
    }
    const para = Array.isArray(destino)
      ? destino.filter(Boolean).join(', ')
      : destino;
    const port = Number(c.port) || 587;
    const transporter = nodemailer.createTransport({
      host: c.host,
      port,
      secure: port === 465,
      requireTLS: port !== 465 && c.useTls,
      auth: c.user ? { user: c.user, pass: c.senha } : undefined,
      connectionTimeout: 20_000,
    });
    try {
      await transporter.sendMail({
        from: c.remetente || c.user,
        to: para,
        subject: assunto,
        text: corpo,
        attachments: anexos
          .filter((a) => existsSync(a.caminho))
          .map((a) => ({ path: a.caminho, filename: a.nomeArquivo })),
      });
      return { ok: true, erro: null };
    } catch (e) {
      return { ok: false, erro: this.erroAmigavel(e, c.host) };
    } finally {
      transporter.close();
    }
  }

  private erroAmigavel(e: unknown, host: string): string {
    const codigo = (e as NodeJS.ErrnoException)?.code;
    const texto =
      e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
      return (
        `Servidor SMTP não encontrado (${host}). Confira o host em Config → E-mail — ` +
        'ex.: smtp.office365.com (587, TLS) ou o endereço do relay interno.'
      );
    }
    if (texto.toLowerCase().includes('auth')) {
      return (
        'Falha de autenticação (usuário/senha rejeitados). O Microsoft 365 não aceita mais ' +
        'usuário e senha no SMTP: use Config → E-mail (Microsoft 365). Num relay interno, ' +
        'deixe o usuário em branco (o relay autoriza pelo IP do servidor).'
      );
    }
    return texto;
  }
}
