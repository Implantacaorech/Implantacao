/** Texto gravado quando a pergunta é marcada como "Não será utilizado.". Espelha
 * TEXTO_NAO_UTILIZADO de `backend/src/levantamento/levantamento-resposta.service.ts` — quem
 * manda é o backend (a tela só mostra na hora, sem esperar a ida ao servidor). */
export const TEXTO_NAO_UTILIZADO =
  'Este campo foi desconsiderado, pois esta funcionalidade não será utilizada pelo cliente.';

export interface LevantamentoRespostaLinha {
  id: number;
  projetoId: number;
  ordem: number;
  moduloSigla: string;
  modulo: string;
  adicional: string;
  topico: string;
  resposta: string;
  naoUtilizado: boolean;
  /** Versão no banco — devolvida a cada gravação para o backend detectar edição simultânea. */
  versao: number;
  atualizadoPor: string;
  atualizadoEm: string | null;
}

export interface LevantamentoResumo {
  respondidas: number;
  total: number;
}

export interface LevantamentoDados {
  linhas: LevantamentoRespostaLinha[];
  resumo: LevantamentoResumo;
}

/** Outro técnico com a mesma tela aberta e onde ele está agora. */
export interface PresencaLevantamento {
  usuarioId: number;
  nome: string;
  linhaId: number | null;
}

export interface SincronizacaoLevantamento {
  presentes: PresencaLevantamento[];
  linhas: LevantamentoRespostaLinha[];
  resumo: LevantamentoResumo;
  /** Relógio do servidor — vira o `desde` do próximo tique. */
  agora: string;
}
