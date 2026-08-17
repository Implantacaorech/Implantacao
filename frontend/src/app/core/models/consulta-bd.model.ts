export interface ConsultaBD {
  id: number;
  slug: string;
  nome: string;
  sql: string;
  ordem: number;
  colunaData: string;
  colunaSituacao: string;
  mostrarGrafico: boolean;
  /** Em qual conexão externa a consulta roda: 'sicla' (Oracle) ou 'portal' (banco do
   * Portal Rech, cadastrado na mesma tela). */
  conexao: string;
}

export interface SalvarConsultaBdPayload {
  nome?: string;
  sql?: string;
  ordem?: number;
  colunaData?: string;
  colunaSituacao?: string;
  mostrarGrafico?: boolean;
  conexao?: string;
  slug?: string;
}

/** Configuração da conexão com o banco do Portal Rech (a senha nunca volta do backend). */
export interface ConfigPortalDb {
  host: string;
  porta: string;
  banco: string;
  usuario: string;
  url: string;
  ativo: boolean;
  temSenha: boolean;
}

export interface ResultadoExecucaoSql {
  ok: boolean;
  mensagem: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
}
