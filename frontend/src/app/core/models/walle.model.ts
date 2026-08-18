/** Modelos da tela Execução → Wall-e (base de conhecimento do acervo de chats do bot).
 * Espelham as respostas de `backend/src/walle/` com nulos explícitos. */

export interface StatusAcervoWalle {
  dirAcervo: string;
  fonteDisponivel: boolean;
  chats: number;
  arquivos: number;
  ultimaAtualizacao: string | null;
  ultimoResumo: {
    disponivel: boolean;
    mensagem: string;
    novos: number;
    alterados: number;
    removidos: number;
    inalterados: number;
    duracaoMs: number;
  } | null;
  oracle: {
    disponivel: boolean;
    mensagem: string;
    chatsOracle: number | null;
    enriquecidos: number;
  } | null;
  limitacoes: string;
}

export interface ResultadoWalle {
  arquivoId: number;
  chat: number;
  chatDescricao: string;
  tecnico: string;
  sistema: string;
  titulo: string;
  resumo: string;
  categoria: string;
  origem: string;
  extensao: string;
  modificadoEm: string | null;
  relevancia: number;
  confianca: 'alta' | 'media' | 'baixa';
  assuntos: string[];
  evidencias: string[];
}

export interface SqlRelacionadoWalle {
  arquivoId: number;
  chat: number;
  objetivo: string;
  tabelas: string[];
  operacoes: string[];
}

export interface RespostaBuscaWalle {
  resumo: string;
  total: number;
  resultados: ResultadoWalle[];
  assuntosRelacionados: string[];
  tambemPodeSerUtil: Array<ResultadoWalle & { motivo: string }>;
  sqlsRelacionados: SqlRelacionadoWalle[];
  sugestoes: string[];
  cobertura: string;
}

export interface FonteRespostaWalle {
  indice: number;
  arquivoId: number;
  chat: number;
  titulo: string;
  caminhoRelativo: string;
}

export interface RespostaIaWalle {
  resposta: string;
  fontes: FonteRespostaWalle[];
  temFundamento: boolean;
  iaDisponivel: boolean;
  busca: RespostaBuscaWalle;
}

export interface ChatWalle {
  codigo: number;
  descricao: string;
  tecnico: string;
  sistema: string;
  origemMetadados: 'acervo' | 'oracle';
  totalArquivos: number;
  ultimoArquivoEm: string | null;
}

export interface ArquivoWalleResumo {
  id: number;
  caminhoRelativo: string;
  chatCodigo: number;
  nome: string;
  extensao: string;
  categoria: string;
  origem: string;
  titulo: string;
  resumo: string;
  assuntos: string;
  tamanhoBytes: number;
  modificadoEm: string | null;
  removido: boolean;
}

export interface ArquivoWalle extends ArquivoWalleResumo {
  conteudo: string;
}

export interface VisaoChatWalle {
  chat: ChatWalle;
  arquivos: ArquivoWalleResumo[];
  assuntos: string[];
  entidades: Array<{ tipo: string; valor: string }>;
  relacionados: Array<{ codigo: number; descricao: string; motivo: string }>;
}

export interface FiltrosWalle {
  q?: string;
  chat?: number;
  categoria?: string;
  origem?: string;
  assunto?: string;
}
