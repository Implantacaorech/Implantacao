export type StatusAgenteExecucao = 'em_execucao' | 'concluido' | 'falhou';

export interface AgenteExecucao {
  id: number;
  agente: string;
  agentePaiId: number | null;
  tarefa: string;
  status: StatusAgenteExecucao;
  resultado: string | null;
  iniciadoEm: string;
  concluidoEm: string | null;
}

export type CategoriaAgente = 'negocio' | 'software';

export interface NoGrafoAgente {
  id: string;
  categoria: CategoriaAgente;
  rotulo: string;
  ativo: boolean;
  execucoes24h: number;
}

export interface ArestaGrafoAgente {
  de: string;
  para: string;
  relacao: string;
}

export interface GrafoAgentes {
  nos: NoGrafoAgente[];
  arestas: ArestaGrafoAgente[];
}
