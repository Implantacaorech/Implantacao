/** Modelos da tela Execução → Consultor SIGER — espelham o backend
 * (`backend/src/consultor-siger/consultor-siger.constants.ts`). */

export type VisaoConsulta = 'funcional' | 'tecnica';
export type ConfiancaConsulta = 'alta' | 'media' | 'baixa' | 'nao_confirmado';

export interface FonteEvidencia {
  arquivo: string;
  linha: number;
  versao: string;
  referencia: string;
  tipo: string;
}

export interface ItemSecao {
  texto: string;
  fonte: FonteEvidencia;
}

export interface AssuntoRelacionado {
  titulo: string;
  pesquisa: string;
}

export interface InterpretacaoPergunta {
  acao: string;
  termos: string[];
  termosExpandidos: string[];
}

export interface RespostaConsultorSiger {
  pergunta: string;
  visao: VisaoConsulta;
  disponivel: boolean;
  interpretacao: InterpretacaoPergunta | null;
  secoes: Record<string, ItemSecao[]>;
  assuntosRelacionados: AssuntoRelacionado[];
  sugestoes: string[];
  fontes: FonteEvidencia[];
  confianca: ConfiancaConsulta;
  aviso: string | null;
}

export interface StatusConsultorSiger {
  disponivel: boolean;
  caminho: string;
  entidades: number;
  chunks: number;
  atualizadoEm: string | null;
  versaoCobol: string;
  versaoAtual: string;
}
