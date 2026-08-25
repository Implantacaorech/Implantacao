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
  /** Nomes das consultas que este token autoriza — a autorização é POR CONSULTA. */
  consultas: string[];
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

// ── Consultas criadas pela TELA (Portal de Conexões) ────────────────────────────────

export type TipoParametroApi =
  | 'data'
  | 'competencia'
  | 'datahora_minuto'
  | 'inteiro'
  | 'texto'
  | 'texto_busca'
  | 'lista_texto';

export const TIPOS_PARAMETRO: { valor: TipoParametroApi; rotulo: string }[] = [
  { valor: 'data', rotulo: 'Data (AAAA-MM-DD)' },
  { valor: 'competencia', rotulo: 'Competência (AAAA-MM)' },
  { valor: 'datahora_minuto', rotulo: 'Data e hora (AAAA-MM-DD HH:MM)' },
  { valor: 'inteiro', rotulo: 'Número inteiro' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'texto_busca', rotulo: 'Texto de busca (aplica % automaticamente)' },
  { valor: 'lista_texto', rotulo: 'Lista de textos (para IN)' },
];

/** Uma consulta salva no Portal de Conexões, com os campos de publicação. */
export interface ConsultaPublicadaResumo {
  slug: string;
  nome: string;
  conexao: ChaveConexao;
  sql: string;
  nomeApi: string;
  publicada: boolean;
  parametros: ParametroConsulta[];
  colunas: string[];
  limiteLinhas: number;
  cacheSegundos: number;
}

/** Resposta do "Testar": é daqui que sai o contrato, sem digitação. */
export interface AnaliseConsulta {
  ok: boolean;
  mensagem: string;
  binds: string[];
  colunas: string[];
  amostra: Record<string, unknown> | null;
  ms: number;
}

// ── Conexões (editáveis no Portal API) ─────────────────────────────────────────────

/** A configuração de uma conexão como a tela a recebe: **sem a senha**, com o sinal de que
 * existe uma gravada. */
export interface ConfiguracaoConexao extends EstadoConexao {
  campos: Record<string, string | boolean>;
  temSenha: boolean;
}

export interface TesteConexao {
  ok: boolean;
  mensagem: string;
  ms: number;
}

// ── Tokens que o Painel usa para consultar o Portal API ────────────────────────────

export interface TokenApiDados {
  id: number;
  nome: string;
  url: string;
  /** O token nunca volta do servidor — só o prefixo, que basta para reconhecê-lo. */
  prefixo: string;
  consultas: string[];
  ativo: boolean;
  observacao: string;
  criadoEm: string;
  ultimoUsoEm: string | null;
  ultimoErro: string | null;
}

export interface PainelTokens {
  itens: TokenApiDados[];
  /** Consultas do catálogo que token ativo nenhum cobre — o que ainda vai pelo banco. */
  descobertas: string[];
  consumoRemotoAtivo: boolean;
}

/** Resposta do "Testar" de um token: o catálogo que ELE enxerga no Portal API. */
export interface SondagemToken {
  ok: boolean;
  mensagem: string;
  consultas: string[];
}
