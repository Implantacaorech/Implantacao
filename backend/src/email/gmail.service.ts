import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { AppConfig } from '../config/configuration';
import { Anexo } from './anexo';

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

/** `nodemailer/lib/mail-composer` é um subcaminho sem tipos publicados, então o `require`
 * entrava como `any` e contaminava tudo que passava por ele. Declaramos aqui só a fatia da
 * API que este serviço usa — montar a mensagem MIME crua que a API do Gmail espera. */
interface OpcoesMailComposer {
  to: string;
  subject: string;
  text: string;
  // `filename` é opcional: `Anexo.nomeArquivo` também é, e sem ele o mail-composer usa o
  // nome do próprio arquivo no disco.
  attachments: { path: string; filename?: string }[];
}
interface MensagemCompilada {
  build(retorno: (erro: Error | null, mensagem: Buffer) => void): void;
}
interface MailComposerInstancia {
  compile(): MensagemCompilada;
}
type ConstrutorMailComposer = new (
  opcoes: OpcoesMailComposer,
) => MailComposerInstancia;

const MailComposer =
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- subcaminho sem tipos
  require('nodemailer/lib/mail-composer') as ConstrutorMailComposer;

/** Bloco de credenciais do arquivo client_secret.json baixado do Google Cloud. */
interface BlocoCliente {
  client_id?: string;
  client_secret?: string;
  redirect_uris?: string[];
}
interface ArquivoClienteOAuth {
  web?: BlocoCliente;
  installed?: BlocoCliente;
}

export interface ResultadoEnvio {
  ok: boolean;
  erro: string | null;
}

interface ClienteOAuth {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Envio de e-mail pela API do Gmail (OAuth2 sobre HTTPS) — contorna o bloqueio de SMTP
 * na rede, porta 443 só. Espelha webapp/gmail_api.py, com UMA diferença deliberada de
 * arquitetura (decidida com o usuário): o Flask original usa o fluxo OAuth "Desktop app"
 * (`InstalledAppFlow.run_local_server` — abre um navegador e um servidor HTTP local
 * efêmero NA MÁQUINA do Painel); aqui, por ser um backend sem interação de desktop, o
 * fluxo é "Web application" com uma rota de callback real
 * (`GET /config/gmail/callback`) — exige criar um credencial OAuth tipo "Aplicativo da
 * Web" no Google Cloud Console (não "Desktop"), com essa URL cadastrada como redirect
 * URI autorizado. Ver docs/migracao/03-documento-conversao.md. */
@Injectable()
export class GmailService {
  private readonly logger = new Logger('GmailService');

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private dir(): string {
    const base =
      process.env.NODE_ENV === 'test'
        ? join(
            process.cwd(),
            'dados',
            `email_test_${process.env.JEST_WORKER_ID ?? '0'}`,
          )
        : join(process.cwd(), 'dados');
    mkdirSync(base, { recursive: true });
    return base;
  }

  private arquivoCliente(): string {
    return join(this.dir(), 'gmail_client.json');
  }

  private arquivoToken(): string {
    return join(this.dir(), 'gmail_token.json');
  }

  temCliente(): boolean {
    return existsSync(this.arquivoCliente());
  }

  configurado(): boolean {
    return existsSync(this.arquivoToken());
  }

  salvarCliente(conteudo: Buffer): void {
    writeFileSync(this.arquivoCliente(), conteudo);
  }

  private lerCliente(): ClienteOAuth | null {
    if (!this.temCliente()) return null;
    try {
      const json = JSON.parse(
        readFileSync(this.arquivoCliente(), 'utf8'),
      ) as ArquivoClienteOAuth;
      const bloco = json.web ?? json.installed;
      if (!bloco?.client_id || !bloco?.client_secret) return null;
      const redirectUri =
        this.config.get('gmailRedirectUri', { infer: true }) ??
        bloco.redirect_uris?.[0];
      return {
        clientId: bloco.client_id,
        clientSecret: bloco.client_secret,
        redirectUri,
      };
    } catch {
      return null;
    }
  }

  private cliente(): OAuth2Client | null {
    const c = this.lerCliente();
    if (!c) return null;
    return new OAuth2Client(c.clientId, c.clientSecret, c.redirectUri);
  }

  // Estado do fluxo OAuth em memória — proteção mínima de CSRF no callback público (ver
  // comentário na classe: a rota de callback não pode exigir JWT, pois é o navegador do
  // Google navegando diretamente até ela, sem cabeçalho Authorization). Só 1 autorização
  // pendente por vez é o suficiente aqui — é uma ação manual de operador, não um fluxo
  // multiusuário concorrente.
  private estadoPendente: string | null = null;

  /** URL de consentimento do Google — o operador abre no navegador para autorizar. */
  urlAutorizacao(): string | null {
    const client = this.cliente();
    if (!client) return null;
    this.estadoPendente = randomBytes(16).toString('hex');
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state: this.estadoPendente,
    });
  }

  /** Troca o `code` do redirect do Google por tokens e grava o arquivo local. Confere o
   * `state` contra o gerado em `urlAutorizacao()` antes de trocar o código. */
  async trocarCodigoPorToken(
    code: string,
    state: string,
  ): Promise<ResultadoEnvio> {
    if (!this.estadoPendente || state !== this.estadoPendente) {
      return {
        ok: false,
        erro: 'Autorização inválida ou expirada — clique em Autorizar novamente.',
      };
    }
    this.estadoPendente = null;
    const client = this.cliente();
    if (!client) {
      return {
        ok: false,
        erro: 'Falta a credencial OAuth (gmail_client.json) do Google Cloud.',
      };
    }
    try {
      const { tokens } = await client.getToken(code);
      writeFileSync(
        this.arquivoToken(),
        JSON.stringify(tokens, null, 2),
        'utf8',
      );
      return { ok: true, erro: null };
    } catch (e) {
      return {
        ok: false,
        erro:
          e instanceof Error
            ? `${e.constructor.name}: ${e.message}`
            : String(e),
      };
    }
  }

  /** Carrega o token salvo, atualizando o client (renova sozinho na 1ª chamada que
   * precisar, via `google-auth-library`) e regravando o arquivo se o token mudou. */
  private credenciais(): OAuth2Client | null {
    if (!this.configurado()) return null;
    const client = this.cliente();
    if (!client) return null;
    try {
      const tokens = JSON.parse(
        readFileSync(this.arquivoToken(), 'utf8'),
      ) as Credentials;
      client.setCredentials(tokens);
      client.on('tokens', (novos) => {
        const atual = { ...tokens, ...novos };
        writeFileSync(
          this.arquivoToken(),
          JSON.stringify(atual, null, 2),
          'utf8',
        );
      });
      return client;
    } catch (e) {
      this.logger.error(
        'Falha ao carregar token do Gmail',
        e instanceof Error ? e.stack : String(e),
      );
      return null;
    }
  }

  async enviar(
    destino: string | string[],
    assunto: string,
    corpo: string,
    anexos: Anexo[] = [],
  ): Promise<ResultadoEnvio> {
    const client = this.credenciais();
    if (!client) {
      return {
        ok: false,
        erro: 'Gmail API não autorizado (Config → Gmail API).',
      };
    }
    const para = Array.isArray(destino)
      ? destino.filter(Boolean).join(', ')
      : destino;
    const composer = new MailComposer({
      to: para,
      subject: assunto,
      text: corpo,
      attachments: anexos
        .filter((a) => existsSync(a.caminho))
        .map((a) => ({ path: a.caminho, filename: a.nomeArquivo })),
    });
    const cru: Buffer = await new Promise((resolve, reject) => {
      composer.compile().build((err: Error | null, message: Buffer) => {
        if (err) reject(err);
        else resolve(message);
      });
    });
    const raw = cru
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    try {
      const { token } = await client.getAccessToken();
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        },
      );
      if (res.status === 200) return { ok: true, erro: null };
      const texto = await res.text();
      return {
        ok: false,
        erro: `Gmail API ${res.status}: ${texto.slice(0, 140)}`,
      };
    } catch (e) {
      return {
        ok: false,
        erro:
          e instanceof Error
            ? `${e.constructor.name}: ${e.message}`
            : String(e),
      };
    }
  }
}
