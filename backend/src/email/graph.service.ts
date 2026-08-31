import { Injectable, Logger } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { Anexo } from './anexo';
import { ResultadoEnvio } from './resultado-envio';

export interface ConfigGraph {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  remetente: string;
}

const ESCOPO = 'https://graph.microsoft.com/.default';

/** Teto de anexos por mensagem. O `sendMail` do Graph carrega os anexos EMBUTIDOS no JSON,
 * em base64 (que infla ~37%), e a requisição inteira é recusada acima de ~4 MB. Passar
 * disso exigiria o fluxo de rascunho + `createUploadSession`, que não foi implementado
 * porque os documentos gerados pelo Painel ficam na casa das centenas de KB. O limite aqui
 * é sobre os bytes CRUS, com folga para o corpo e os cabeçalhos — melhor barrar com uma
 * mensagem que explica do que devolver um 413 opaco da Microsoft. */
const LIMITE_ANEXOS_BYTES = 2.5 * 1024 * 1024;

/** Envio de e-mail pela API do Microsoft Graph (OAuth2 client credentials, só HTTPS/443).
 *
 * É o caminho oficial para a caixa `implantacao@rech.com.br` desde que a Microsoft aposentou
 * a autenticação básica no Exchange Online — usuário e senha no SMTP deixaram de funcionar,
 * então o `MailerService` passou a tentar este serviço ANTES do SMTP.
 *
 * O fluxo é **app-only**: o backend autentica como aplicativo, sem consentimento interativo,
 * sem navegador e sem refresh token — por isso não existe rota de callback aqui. O único
 * estado guardado é o access token em memória, renovado quando expira.
 *
 * As credenciais vêm do registro de aplicativo no Entra ID e são fornecidas pelo TI nas
 * variáveis de ambiente `EMAIL_GRAPH_*`/`EMAIL_REMETENTE` (nomes definidos por eles). Os
 * apelidos `MIGRACAO_GRAPH_*` são aceitos pela consistência com o resto do backend, que usa
 * esse prefixo. Como no SMTP, o ambiente tem prioridade sobre o arquivo local
 * (`dados/graph.json`), que existe para a tela Config → E-mail (Microsoft 365) — o segredo
 * fica só na máquina, nunca versionado nem no banco.
 *
 * ⚠️ A permissão `Mail.Send` de APLICAÇÃO dá acesso a todas as caixas do tenant. O TI
 * restringiu o aplicativo à caixa de implantação por `ApplicationAccessPolicy`; um envio com
 * outro remetente é recusado com `ErrorAccessDenied` — ver `erroAmigavel`. */
@Injectable()
export class GraphService {
  private readonly logger = new Logger('GraphService');

  /** Access token em memória (app-only não tem refresh token: quando expira, pede outro).
   * Some a cada reinício do processo, que é o comportamento desejado. */
  private token: { valor: string; expiraEm: number } | null = null;

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

  private arquivo(): string {
    return join(this.dir(), 'graph.json');
  }

  carregarConfig(): ConfigGraph {
    let cfg: Partial<ConfigGraph> = {};
    if (existsSync(this.arquivo())) {
      try {
        cfg = JSON.parse(
          readFileSync(this.arquivo(), 'utf8'),
        ) as Partial<ConfigGraph>;
      } catch {
        cfg = {};
      }
    }
    const env: Partial<Record<keyof ConfigGraph, string | undefined>> = {
      tenantId:
        process.env.EMAIL_GRAPH_TENANT_ID ??
        process.env.MIGRACAO_GRAPH_TENANT_ID,
      clientId:
        process.env.EMAIL_GRAPH_CLIENT_ID ??
        process.env.MIGRACAO_GRAPH_CLIENT_ID,
      clientSecret:
        process.env.EMAIL_GRAPH_CLIENT_SECRET ??
        process.env.MIGRACAO_GRAPH_CLIENT_SECRET,
      remetente:
        process.env.EMAIL_REMETENTE ?? process.env.MIGRACAO_EMAIL_REMETENTE,
    };
    for (const [k, v] of Object.entries(env)) {
      if (v) (cfg as Record<string, string>)[k] = v;
    }
    return {
      tenantId: cfg.tenantId ?? '',
      clientId: cfg.clientId ?? '',
      clientSecret: cfg.clientSecret ?? '',
      remetente: cfg.remetente ?? '',
    };
  }

  salvarConfig(dados: {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    remetente?: string;
  }): ConfigGraph {
    // replace, não só trim: o segredo copiado do portal do Entra às vezes vem com quebra de
    // linha ou espaço colado no fim — mesmo achado das senhas de app em mailer.service.ts.
    const segredo = (dados.clientSecret || '').replace(/\s+/g, '');
    const cfg: ConfigGraph = {
      tenantId: (dados.tenantId || '').trim(),
      clientId: (dados.clientId || '').trim(),
      remetente: (dados.remetente || '').trim(),
      // não apaga o segredo ao reeditar sem preencher de novo
      clientSecret: segredo || this.carregarConfig().clientSecret,
    };
    writeFileSync(this.arquivo(), JSON.stringify(cfg, null, 2), 'utf8');
    // A credencial mudou: o token em cache foi emitido pela anterior e não vale mais.
    this.token = null;
    return cfg;
  }

  configurado(): boolean {
    const c = this.carregarConfig();
    return Boolean(c.tenantId && c.clientId && c.clientSecret && c.remetente);
  }

  /** Access token app-only, do cache enquanto valer. Devolve `null` e a mensagem de erro
   * quando a Microsoft recusa a credencial. */
  private async obterToken(
    cfg: ConfigGraph,
  ): Promise<{ token: string | null; erro: string | null }> {
    // 60s de folga: um token que expira no caminho entre a validação e o uso viraria um 401
    // intermitente, o pior tipo de falha para diagnosticar depois.
    if (this.token && this.token.expiraEm > Date.now() + 60_000) {
      return { token: this.token.valor, erro: null };
    }
    const url = `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`;
    const corpo = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: ESCOPO,
      grant_type: 'client_credentials',
    });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corpo.toString(),
        signal: AbortSignal.timeout(20_000),
      });
      const texto = await res.text();
      if (!res.ok) {
        return { token: null, erro: this.erroDeToken(res.status, texto) };
      }
      const dados = JSON.parse(texto) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!dados.access_token) {
        return {
          token: null,
          erro: 'A Microsoft respondeu sem access_token — confira as credenciais em Config → E-mail (Microsoft 365).',
        };
      }
      this.token = {
        valor: dados.access_token,
        expiraEm: Date.now() + (dados.expires_in ?? 3600) * 1000,
      };
      return { token: dados.access_token, erro: null };
    } catch (e) {
      return { token: null, erro: this.erroDeRede(e) };
    }
  }

  async enviar(
    destino: string | string[],
    assunto: string,
    corpo: string,
    anexos: Anexo[] = [],
  ): Promise<ResultadoEnvio> {
    const cfg = this.carregarConfig();
    if (!this.configurado()) {
      return {
        ok: false,
        erro: 'Microsoft 365 não configurado (Config → E-mail (Microsoft 365)).',
      };
    }
    const para = (Array.isArray(destino) ? destino : destino.split(/[,;]/))
      .map((d) => d.trim())
      .filter(Boolean);
    if (!para.length) {
      return { ok: false, erro: 'Nenhum destinatário informado.' };
    }

    let anexosGraph: {
      '@odata.type': string;
      name: string;
      contentType: string;
      contentBytes: string;
    }[];
    try {
      anexosGraph = await this.montarAnexos(anexos);
    } catch (e) {
      return {
        ok: false,
        erro: e instanceof Error ? e.message : String(e),
      };
    }

    const { token, erro } = await this.obterToken(cfg);
    if (!token) return { ok: false, erro };

    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.remetente)}/sendMail`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: assunto,
            body: { contentType: 'Text', content: corpo },
            toRecipients: para.map((endereco) => ({
              emailAddress: { address: endereco },
            })),
            attachments: anexosGraph,
          },
          // Guarda a cópia em Itens Enviados da caixa compartilhada — é o registro de que o
          // e-mail saiu, consultável por qualquer pessoa com acesso à caixa (o Painel também
          // registra o evento, mas a prova no lado do e-mail vale por si).
          saveToSentItems: true,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      // sendMail responde 202 Accepted, sem corpo.
      if (res.status === 202) return { ok: true, erro: null };
      const texto = await res.text();
      return { ok: false, erro: this.erroDeEnvio(res.status, texto, cfg) };
    } catch (e) {
      return { ok: false, erro: this.erroDeRede(e) };
    }
  }

  /** Lê os anexos do disco e converte para o formato do Graph. Arquivo inexistente é
   * ignorado, mesmo comportamento do SMTP (ver Anexo). */
  private async montarAnexos(anexos: Anexo[]): Promise<
    {
      '@odata.type': string;
      name: string;
      contentType: string;
      contentBytes: string;
    }[]
  > {
    const existentes = anexos.filter((a) => existsSync(a.caminho));
    const total = existentes.reduce((s, a) => s + statSync(a.caminho).size, 0);
    if (total > LIMITE_ANEXOS_BYTES) {
      const mb = (total / 1024 / 1024).toFixed(1);
      throw new Error(
        `Anexos somam ${mb} MB e o envio pelo Microsoft 365 aceita no máximo ` +
          `${(LIMITE_ANEXOS_BYTES / 1024 / 1024).toFixed(1)} MB por mensagem. ` +
          'Envie os arquivos maiores por link (OneDrive/SharePoint) ou em mensagens separadas.',
      );
    }
    return Promise.all(
      existentes.map(async (a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.nomeArquivo || basename(a.caminho),
        contentType: 'application/octet-stream',
        contentBytes: (await readFile(a.caminho)).toString('base64'),
      })),
    );
  }

  private erroDeToken(status: number, texto: string): string {
    const codigo = this.codigoAad(texto);
    if (codigo.includes('AADSTS7000215') || texto.includes('invalid_client')) {
      return (
        'Segredo do aplicativo (client secret) inválido ou EXPIRADO. Segredos do Entra ID ' +
        'têm validade — peça um novo ao TI e salve em Config → E-mail (Microsoft 365).'
      );
    }
    if (codigo.includes('AADSTS700016') || codigo.includes('AADSTS7000229')) {
      return (
        'Aplicativo não encontrado no tenant informado. Confira o Client ID e o Tenant ID ' +
        'com o TI (Config → E-mail (Microsoft 365)).'
      );
    }
    if (codigo.includes('AADSTS90002')) {
      return 'Tenant ID não encontrado na Microsoft. Confira o valor em Config → E-mail (Microsoft 365).';
    }
    this.logger.warn(`Falha ao obter token do Graph (${status})`);
    return `Autenticação na Microsoft falhou (${status}): ${texto.slice(0, 200)}`;
  }

  private erroDeEnvio(status: number, texto: string, cfg: ConfigGraph): string {
    if (status === 401) {
      return (
        'A Microsoft recusou o token (401). Normalmente falta o CONSENTIMENTO DE ' +
        'ADMINISTRADOR na permissão Mail.Send do aplicativo — confirme com o TI.'
      );
    }
    if (status === 403) {
      return (
        `Sem permissão para enviar como ${cfg.remetente} (403). O aplicativo está ` +
        'restrito a caixas específicas (ApplicationAccessPolicy): confirme com o TI que ' +
        'esse endereço é o autorizado, ou ajuste o remetente em Config → E-mail ' +
        '(Microsoft 365).'
      );
    }
    if (status === 404) {
      return (
        `Caixa ${cfg.remetente} não encontrada no tenant (404). Confira o endereço do ` +
        'remetente — precisa ser uma caixa real, não um alias.'
      );
    }
    if (status === 413) {
      return 'Mensagem grande demais para o Microsoft 365 — reduza os anexos.';
    }
    if (status === 429) {
      return 'A Microsoft está limitando os envios (429). Aguarde alguns minutos e tente de novo.';
    }
    return `Microsoft Graph ${status}: ${texto.slice(0, 200)}`;
  }

  private erroDeRede(e: unknown): string {
    const codigo = (e as NodeJS.ErrnoException)?.code;
    if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
      return (
        'Não foi possível alcançar a Microsoft (login.microsoftonline.com / ' +
        'graph.microsoft.com). Confirme com o TI a liberação de saída na porta 443 para ' +
        'esses endereços a partir do servidor do Painel.'
      );
    }
    if (e instanceof Error && e.name === 'TimeoutError') {
      return (
        'Tempo esgotado ao falar com a Microsoft. Pode ser proxy/firewall barrando a saída ' +
        'HTTPS do servidor do Painel.'
      );
    }
    return e instanceof Error
      ? `${e.constructor.name}: ${e.message}`
      : String(e);
  }

  /** Extrai o código AADSTS da resposta de erro do endpoint de token (vem no
   * `error_description`, em texto corrido). */
  private codigoAad(texto: string): string {
    return /AADSTS\d+/.exec(texto)?.[0] ?? '';
  }
}
