import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { WalleChatsRepository } from './repositories/walle-chats.repository';

export const SLUG_CONSULTA_WALLE_CHATS = 'walle_chats_sicla';
const NOME_CONSULTA_WALLE_CHATS = 'Wall-e — chats no SICLA (CHAT_WALLE)';

/** SQL padrão da Fonte B — colunas confirmadas na DDL oficial de `SICLA.CHAT_WALLE`
 * (F:\Sicla\oracle\schema\tables\CHAT_WALLE.sql, verificada em 2026-08-18). Editável sem
 * deploy na tela Consultas BD (mesmo desenho da consulta do módulo RNS): se o DBA expuser a
 * view `LISTA_CHAT_WALLE` (que decodifica técnico/sistema), basta trocar o SELECT lá. */
export const SQL_CONSULTA_WALLE_CHATS_PADRAO = `SELECT CODIGO, DESCRICAO, TECNICO, SISTEMA
  FROM SICLA.CHAT_WALLE
 ORDER BY CODIGO`;

export interface CoberturaOracle {
  disponivel: boolean;
  mensagem: string;
  chatsOracle: number | null;
  enriquecidos: number;
}

/** Fonte B do módulo Wall-e: metadados dos chats direto do Oracle do SICLA (`CHAT_WALLE`),
 * pela MESMA conexão somente-SELECT usada pela Disponibilidade/RNS.
 *
 * É enriquecimento OPCIONAL (§22): sem conexão configurada ou com o SICLA fora, o módulo
 * segue funcionando só com o acervo — este service nunca lança para cima, devolve
 * `disponivel: false` com o motivo. A especificação exige confirmar a estrutura real antes
 * de assumir campos; por isso o SQL é editável e o resultado é validado coluna a coluna. */
@Injectable()
export class WalleOracleService implements OnModuleInit {
  private readonly logger = new Logger(WalleOracleService.name);

  constructor(
    private readonly disponibilidade: DisponibilidadeService,
    private readonly consultas: ConsultaBdService,
    private readonly chats: WalleChatsRepository,
  ) {}

  /** Semeia o SQL padrão (idempotente) para o ADM editar em Consultas BD — nunca
   * sobrescreve edição manual. Mesmo padrão do RnsService. */
  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const existe = await this.consultas.porSlug(SLUG_CONSULTA_WALLE_CHATS);
      if (!existe) {
        await this.consultas.salvar(SLUG_CONSULTA_WALLE_CHATS, {
          nome: NOME_CONSULTA_WALLE_CHATS,
          sql: SQL_CONSULTA_WALLE_CHATS_PADRAO,
          ordem: 96,
          mostrarGrafico: false,
        });
      }
    } catch (e) {
      this.logger.error(
        `Falha ao semear a consulta ${SLUG_CONSULTA_WALLE_CHATS}: ${String(e)}`,
      );
    }
  }

  /** Busca os chats no Oracle e enriquece os metadados locais (descrição/técnico/sistema).
   * Devolve a cobertura documental (§36): quantos chats existem lá × quantos têm arquivos. */
  async enriquecer(): Promise<CoberturaOracle> {
    let sql = SQL_CONSULTA_WALLE_CHATS_PADRAO;
    try {
      const editada = await this.consultas.porSlug(SLUG_CONSULTA_WALLE_CHATS);
      if (editada?.sql?.trim()) sql = editada.sql.trim();
    } catch {
      // sem consulta salva — segue com o padrão
    }

    const r = await this.disponibilidade.executarSql(sql, {}, undefined, 5000);
    if (!r.ok) {
      return {
        disponivel: false,
        mensagem: `SICLA indisponível para enriquecimento: ${r.mensagem}`,
        chatsOracle: null,
        enriquecidos: 0,
      };
    }

    let enriquecidos = 0;
    for (const linha of r.linhas) {
      const codigo = numero(linha, 'CODIGO');
      if (codigo === null) continue;
      const local = await this.chats.porCodigo(codigo);
      if (!local) continue; // só enriquece chat que tem acervo — não inventa chat sem arquivo
      await this.chats.salvar({
        id: local.id,
        codigo,
        descricao: texto(linha, 'DESCRICAO') || local.descricao,
        tecnico: texto(linha, 'TECNICO') || local.tecnico,
        sistema: texto(linha, 'SISTEMA') || local.sistema,
        origemMetadados: 'oracle',
      });
      enriquecidos++;
    }
    return {
      disponivel: true,
      mensagem: 'Metadados enriquecidos pelo SICLA.',
      chatsOracle: r.linhas.length,
      enriquecidos,
    };
  }
}

function texto(linha: Record<string, unknown>, coluna: string): string {
  const v = linha[coluna] ?? linha[coluna.toLowerCase()];
  return v === null || v === undefined ? '' : String(v).trim();
}
function numero(linha: Record<string, unknown>, coluna: string): number | null {
  const v = Number(texto(linha, coluna));
  return Number.isFinite(v) && v > 0 ? v : null;
}
