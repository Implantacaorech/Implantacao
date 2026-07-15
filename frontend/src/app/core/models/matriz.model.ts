export interface MatrizTecnico {
  id: number;
  nome: string;
  setor: string;
  dias: string;
  notas: string;
  atualizadoEm: string | null;
  atualizadoPor: string;
}

export type MatrizTecnicoComContagem = MatrizTecnico & { qtdNotas: number };

export interface MatrizListaView {
  itens: MatrizTecnicoComContagem[];
  restrito: boolean;
  podeAdmin?: boolean;
  redirecionarParaId?: number;
}

export interface MatrizCompetencia {
  id: number;
  sigla: string;
  area: string;
  ordem: number;
}

export type MatrizArea = [string, MatrizCompetencia[]];

export interface MatrizFichaView {
  tecnico: MatrizTecnico;
  areas: MatrizArea[];
  notas: Record<string, number>;
  editavel: boolean;
  volta: boolean;
}

export interface SalvarNotasMatrizPayload {
  setor?: string;
  dias?: string;
  notas?: Record<string, string>;
}

export interface ImportarMatrizResultado {
  ok: boolean;
  mensagem: string;
  novasCompetencias?: number;
  novosTecnicos?: number;
  ignorados?: number;
}
