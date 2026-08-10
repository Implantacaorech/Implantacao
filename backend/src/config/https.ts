import { existsSync, readFileSync } from 'fs';
import type { ServerOptions } from 'https';

export interface HttpsPainel {
  opcoes: ServerOptions;
  porta: number;
  /** Só para a mensagem de boot — o que foi carregado. */
  origem: string;
}

const PORTA_PADRAO = 5443;

function exigirArquivo(caminho: string, nomeVar: string): Buffer {
  if (!existsSync(caminho)) {
    throw new Error(
      `${nomeVar} aponta para um arquivo que não existe: ${caminho}. ` +
        'Gere o certificado com Gerar_Certificado_Painel.ps1 ou corrija a variável.',
    );
  }
  return readFileSync(caminho);
}

/** HTTPS OPCIONAL do painel, ligado só por variável de ambiente.
 *
 * Existe por um motivo concreto: o navegador **só entrega microfone e captura de tela em
 * contexto seguro** (HTTPS ou localhost). Sem TLS, a gravação de reunião fica bloqueada em
 * qualquer máquina que não seja a do próprio servidor — ver docs/gravacao-reuniao.md.
 *
 * Duas formas de fornecer o certificado, porque o caminho natural no Windows é o PFX:
 * - `MIGRACAO_HTTPS_PFX` (+ `MIGRACAO_HTTPS_PFX_SENHA`) — é o que o
 *   `New-SelfSignedCertificate`/CA interna exporta, e o Node lê direto (dispensa OpenSSL);
 * - `MIGRACAO_HTTPS_CERT` + `MIGRACAO_HTTPS_KEY` — par PEM, para certificado emitido por
 *   uma CA que já entregue nesse formato.
 *
 * Sem nenhuma das duas, devolve `null` e o painel sobe exatamente como sempre subiu (HTTP
 * puro na 5100) — nada muda para quem não configurar. Configurado, o painel passa a
 * responder **nos dois**: HTTP na porta de sempre (links e favoritos antigos continuam
 * valendo) e HTTPS em `MIGRACAO_HTTPS_PORT` (padrão 5443), no MESMO processo — a entrega em
 * processo único do §4.8 continua de pé.
 *
 * Falha o boot se a variável estiver definida e o arquivo não existir: subir "sem HTTPS,
 * silenciosamente" seria pior — a gravação voltaria a ficar bloqueada sem ninguém entender
 * por quê. */
export function httpsPainel(): HttpsPainel | null {
  const porta = Number(process.env.MIGRACAO_HTTPS_PORT ?? PORTA_PADRAO);
  const pfx = (process.env.MIGRACAO_HTTPS_PFX ?? '').trim();
  if (pfx) {
    return {
      opcoes: {
        pfx: exigirArquivo(pfx, 'MIGRACAO_HTTPS_PFX'),
        passphrase: process.env.MIGRACAO_HTTPS_PFX_SENHA || undefined,
      },
      porta,
      origem: `PFX ${pfx}`,
    };
  }

  const cert = (process.env.MIGRACAO_HTTPS_CERT ?? '').trim();
  const key = (process.env.MIGRACAO_HTTPS_KEY ?? '').trim();
  if (cert && key) {
    return {
      opcoes: {
        cert: exigirArquivo(cert, 'MIGRACAO_HTTPS_CERT'),
        key: exigirArquivo(key, 'MIGRACAO_HTTPS_KEY'),
      },
      porta,
      origem: `PEM ${cert}`,
    };
  }

  if (cert || key) {
    throw new Error(
      'MIGRACAO_HTTPS_CERT e MIGRACAO_HTTPS_KEY andam juntas — defina as duas (ou use ' +
        'MIGRACAO_HTTPS_PFX).',
    );
  }
  return null;
}
