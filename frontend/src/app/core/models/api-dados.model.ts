/** Contratos da API de Dados (`/api/dados/v1`) — a fronteira única de banco EXTERNO
 * (ADR-0003). Espelham `backend/src/dados/`. */

export type ChaveConexao = 'sicla' | 'portal_rech';

export interface ParametroConsulta {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
  descricao: string;
  maxTamanho?: number;
}

export interface ConsultaPublicada {
  nome: string;
  titulo: string;
  descricao: string;
  conexao: ChaveConexao;
  escopo: string;
  parametros: ParametroConsulta[];
  limiteLinhas: number;
  cacheSegundos: number;
  desde: string;
}

export interface CatalogoDados {
  versao: string;
  total: number;
  consultas: ConsultaPublicada[];
}

export interface EstadoConexao {
  chave: ChaveConexao;
  rotulo: string;
  dialeto: string;
  origem: string;
  configurada: boolean;
}

export interface ClienteApi {
  id: number;
  nome: string;
  prefixo: string;
  escopos: string[];
  ativo: boolean;
  observacao: string;
  criadoEm: string;
  ultimoUsoEm: string | null;
}

/** Só na criação e na rotação: a chave em claro, exibida UMA vez. */
export interface ClienteApiCriado extends ClienteApi {
  chave: string;
}

export interface MetricaConsulta {
  consulta: string;
  execucoes: number;
  acertosCache: number;
  erros: number;
  msTotal: number;
  msMedio: number;
  ultimaEm: string | null;
}
