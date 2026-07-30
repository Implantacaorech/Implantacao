export interface ProjetoCapacidade {
  cliente: string;
  golive: string;
}

export interface LinhaCapacidade {
  nome: string;
  perfil: string;
  sicla: string;
  clientes: number;
  projetos: ProjetoCapacidade[];
  liberaEm: string;
  livresSemana: number[];
  janela: string;
  notasModulos: Record<string, number>;
  semNota: string[];
  media: number;
  temMatriz: boolean;
  score: number;
  veredito: string;
}

export interface ResultadoCapacidade {
  equipe: LinhaCapacidade[];
  semanas: string[];
  modulos: string[];
  turnosSemana: number;
  /** Setor filtrado ('' = todos, `SETOR_SEM` = sem setor no cadastro). */
  setor: string;
  /** Setores existentes na equipe (lista completa, independente do filtro aplicado). */
  setoresDisponiveis: string[];
  /** Quantos técnicos da equipe estão sem setor no cadastro. */
  semSetor: number;
}

/** Valor do filtro que significa "só quem está sem setor no cadastro". Espelha
 * `SETOR_SEM` de `backend/src/painel/capacidade.service.ts` e a mesma convenção usada no
 * filtro da tela de Usuários. */
export const SETOR_SEM = '__sem__';
