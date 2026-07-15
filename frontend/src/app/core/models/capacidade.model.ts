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
}
