export interface LevantamentoRespostaLinha {
  id: number;
  projetoId: number;
  ordem: number;
  moduloSigla: string;
  modulo: string;
  adicional: string;
  topico: string;
  resposta: string;
}

export interface LevantamentoResumo {
  respondidas: number;
  total: number;
}

export interface LevantamentoDados {
  linhas: LevantamentoRespostaLinha[];
  resumo: LevantamentoResumo;
}
