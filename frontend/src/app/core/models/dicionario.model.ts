export type TipoDicionario = 'modulo' | 'adicional';

export type CategoriaSecao =
  | 'identificacao'
  | 'configuracao'
  | 'rotina'
  | 'dependencia'
  | 'suporte'
  | 'checklist'
  | 'palavras-chave'
  | 'geral';

export interface ResultadoPesquisaDicionario {
  slug: string;
  tipo: TipoDicionario;
  sigla: string;
  titulo: string;
  resumo: string;
  trecho: string | null;
  urlOrigem: string;
}

export interface Segmento {
  texto: string;
  forte?: boolean;
  codigo?: boolean;
}

export type Bloco =
  | { tipo: 'subtitulo'; segmentos: Segmento[] }
  | { tipo: 'paragrafo'; segmentos: Segmento[] }
  | { tipo: 'lista'; itens: Segmento[][] }
  | { tipo: 'tabela'; cabecalho: Segmento[][]; linhas: Segmento[][][] }
  | { tipo: 'codigo'; texto: string };

export interface SecaoDocumento {
  titulo: string;
  corpo: string;
  categoria: CategoriaSecao;
  blocos: Bloco[];
}

export interface DocumentoDetalhe {
  slug: string;
  tipo: TipoDicionario;
  sigla: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  secoes: SecaoDocumento[];
  palavrasChave: string[];
  caminhoOrigem: string;
  urlOrigem: string;
  atualizadoEm: string;
}

export interface FiltroSigla {
  sigla: string;
  titulo: string;
  tipo: TipoDicionario;
}

export interface StatusDicionario {
  totalDocumentos: number;
  totalModulos: number;
  totalAdicionais: number;
  ultimaIngestaoEm: string | null;
}

export interface FonteResposta {
  indice: number;
  slug: string;
  titulo: string;
  urlOrigem: string;
}

export interface RespostaDicionario {
  resposta: string;
  fontes: FonteResposta[];
  temFundamento: boolean;
  iaDisponivel: boolean;
}
