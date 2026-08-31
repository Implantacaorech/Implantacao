import { Logger } from '@nestjs/common';
import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * Checagem de exposição da pasta de CREDENCIAIS (`backend/dados/`) — achado M5 da auditoria de
 * 2026-08-12. Ali moram, em claro, `ia_config.json` (chaves de IA), `smtp.json`/`imap.json`
 * (senhas de e-mail), `mariadb.env` e CSVs. A parte que só o usuário faz é aplicar a ACL (via
 * `tools/Proteger_Dados_ACL.ps1`) e considerar cifra; a parte de SOFTWARE é DENUNCIAR quando a
 * pasta está acessível a grupos amplos, para a exposição não passar despercebida — o mesmo
 * princípio do aviso de privacidade da IA (A1) e das checagens de saúde.
 *
 * O parsing da saída do `icacls` fica isolado nesta função PURA para ser testável sem Windows;
 * a coleta (rodar o `icacls`) é best-effort e só em produção Windows.
 */
export interface AvaliacaoAcl {
  /** `true` se algum principal AMPLO (Everyone/Users/Authenticated Users) tem ACE na pasta. */
  exposto: boolean;
  /** Quais principais amplos foram encontrados — para nomear no aviso. */
  principais: string[];
}

/** Principais que NÃO deveriam ter acesso à pasta de credenciais. Em pt-BR e en-US porque o
 * `icacls` fala o idioma do Windows instalado. A busca é por `NOME:(` — o `icacls` só lista um
 * principal quando ele TEM uma ACE, então a mera presença já é acesso concedido. */
const NOMES_AMPLOS = [
  'Everyone',
  'Todos',
  '\\Users',
  '\\Usuários',
  'Authenticated Users',
  'Usuários Autenticados',
];

/** Avalia a saída textual do `icacls <pasta>`: retorna quais principais amplos têm ACE. */
export function avaliarSaidaIcacls(saida: string): AvaliacaoAcl {
  const principais = NOMES_AMPLOS.filter((n) => saida.includes(`${n}:(`));
  return { exposto: principais.length > 0, principais };
}

/**
 * No boot, roda `icacls` na pasta de credenciais e, se ela estiver aberta a grupos amplos,
 * avisa no log apontando para o script de correção. Best-effort e silenciosa em qualquer
 * falha: fora do Windows não há `icacls`, e um erro aqui jamais pode derrubar o boot.
 */
export function avisarSeDadosExpostos(cwd: string = process.cwd()): void {
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'test') return;
  const logger = new Logger('SegurancaDados');
  const dir = join(cwd, 'dados');
  try {
    const saida = execFileSync('icacls', [dir], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    const r = avaliarSaidaIcacls(saida);
    if (r.exposto) {
      logger.warn(
        `SEGURANÇA/LGPD: a pasta de credenciais ${dir} está acessível a ` +
          `${r.principais.join(', ')} — ali há chaves de IA e senhas de e-mail em claro. ` +
          'Rode tools/Proteger_Dados_ACL.ps1 (uma vez) para restringir a pasta ao SYSTEM, ' +
          'aos Administradores e ao dono do serviço.',
      );
    }
  } catch {
    /* icacls ausente/sem permissão — nada a fazer, é só um aviso. */
  }
}
