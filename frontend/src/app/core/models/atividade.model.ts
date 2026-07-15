export interface ItemFeedAtividade {
  id: number;
  projetoId: number;
  tipo: string;
  descricao: string;
  autor: string;
  criadoEm: string;
  cliente: string;
}

export interface MetricasUso {
  dias: number;
  projetosNovos: number;
  documentos: number;
  emails: number;
  notas: number;
  transicoes: number;
  totalEventos: number;
}

export interface FaseFunil {
  fase: string;
  n: number;
  idadeMedia: number | null;
}

export interface PainelAtividade {
  feed: ItemFeedAtividade[];
  uso: MetricasUso;
  funil: FaseFunil[];
}
