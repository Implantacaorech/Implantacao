import { Injectable } from '@nestjs/common';
import { ChaveConexao, CONEXOES } from '../catalogo/catalogo.types';
import { ValorBind } from '../catalogo/parametros.util';
import { ConexaoPortalService } from './conexao-portal.service';
import { ConexaoSiclaService } from './conexao-sicla.service';

/** Resultado cru de uma execução — o MESMO shape que os dois executores devolvem
 * (`ResultadoExecucao`), de propósito: quem consome não distingue a origem. */
export interface ResultadoBruto {
  ok: boolean;
  mensagem: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
}

export interface EstadoConexao {
  chave: ChaveConexao;
  rotulo: string;
  dialeto: string;
  origem: string;
  /** Cadastrada E ativa — é o que decide se a consulta pode sequer ser tentada. */
  configurada: boolean;
}

/** Campos da CONFIGURAÇÃO da conexão que guardam SQL (tela Disponibilidade). */
export type CampoSqlConexao = 'select' | 'selectTecnicos';

/** ROTEADOR das conexões externas: dado o nome da conexão declarado no catálogo, executa o
 * SQL no driver certo.
 *
 * Desde a fase 2 do ADR-0003 os drivers moram AQUI (`conexao-sicla.service.ts` com
 * `oracledb`, `conexao-portal.service.ts` com `mysql2`). Nenhum módulo do Painel os injeta:
 * quem quer dado externo pede a consulta pelo NOME ao `DadosService`, e é este roteador que
 * decide em qual banco ela roda. A guarda `common/conformidade-api-dados.spec.ts` trava
 * isso — driver importado fora desta pasta quebra o CI. */
@Injectable()
export class ConexoesService {
  constructor(
    private readonly sicla: ConexaoSiclaService,
    private readonly portal: ConexaoPortalService,
  ) {}

  configurada(chave: ChaveConexao): boolean {
    return chave === 'sicla'
      ? this.sicla.configurado()
      : this.portal.configurado();
  }

  estados(): EstadoConexao[] {
    return (Object.keys(CONEXOES) as ChaveConexao[]).map((chave) => ({
      chave,
      ...CONEXOES[chave],
      configurada: this.configurada(chave),
    }));
  }

  /** Mensagem de "não dá para consultar" específica da conexão — diz ONDE se resolve, não
   * só que falhou. */
  motivoIndisponivel(chave: ChaveConexao): string {
    return chave === 'sicla'
      ? 'Conexão com o SICLA não configurada ou inativa (Sistema → Ferramentas → Disponibilidade).'
      : 'Conexão com o banco do Portal Rech não configurada ou inativa (Sistema → Consultas BD).';
  }

  /** SQL guardado na CONFIGURAÇÃO da conexão — a terceira origem de SQL do sistema, ao lado
   * do texto versionado em código e do editável em Consultas BD. Só o SICLA tem: são os
   * dois SELECTs da tela Disponibilidade (ocupação e mapa de técnicos). */
  sqlDeConfiguracao(chave: ChaveConexao, campo: CampoSqlConexao): string {
    return chave === 'sicla' ? this.sicla.sqlDeConfiguracao(campo) : '';
  }

  async executar(
    chave: ChaveConexao,
    sql: string,
    binds: Record<string, ValorBind>,
    limite: number,
  ): Promise<ResultadoBruto> {
    if (chave === 'sicla') {
      // A assinatura do executor Oracle tem `cfg` no 3º lugar (config alternativa usada
      // pelo "Testar" da tela); aqui é sempre a configuração vigente.
      return this.sicla.executarSql(sql, binds, undefined, limite);
    }
    return this.portal.executarSql(sql, binds, limite);
  }
}
