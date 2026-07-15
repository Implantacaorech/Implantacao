export interface ConsultaBD {
  id: number;
  slug: string;
  nome: string;
  sql: string;
  ordem: number;
  colunaData: string;
  colunaSituacao: string;
  mostrarGrafico: boolean;
}

export interface SalvarConsultaBdPayload {
  nome?: string;
  sql?: string;
  ordem?: number;
  colunaData?: string;
  colunaSituacao?: string;
  mostrarGrafico?: boolean;
  slug?: string;
}

export interface ResultadoExecucaoSql {
  ok: boolean;
  mensagem: string;
  colunas: string[];
  linhas: Record<string, unknown>[];
}
