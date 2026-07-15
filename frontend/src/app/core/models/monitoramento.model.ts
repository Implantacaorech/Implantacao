import { Alerta, ResultadoMetricas } from './coordenacao.model';

export type EstadoSetor = 'concluido' | 'aprovacao' | 'sobrecarregado' | 'pendencias' | 'espera' | 'normal';

export interface SetorMonitoramento {
  nome: string;
  estado: EstadoSetor;
  estadoLabel: string;
  andamento: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  aprovacao: number;
  responsaveis: string[];
  tempoMedio: number | null;
  alertas: string[];
}

export interface LinhaCarga {
  nome: string;
  projetos: number;
  horas: number;
  alertas: number;
}

export interface EntregaProxima {
  cliente: string;
  projetoId: number;
  tipo: string;
  data: string;
  dias: number;
  setor: string;
}

export interface LinhaMapa {
  id: number;
  cliente: string;
  etapa: string;
  situacao: string;
  progresso: number;
  consultor: string;
  alertas: number;
  risco: boolean;
  atrasado: boolean;
}

export interface ResultadoMonitoramento {
  m: ResultadoMetricas;
  alertas: Alerta[];
  setores: SetorMonitoramento[];
  saude: number;
  fluxo: { nome: string; n: number; pct: number }[];
  mapa: LinhaMapa[];
  entregas: EntregaProxima[];
  carga: LinhaCarga[];
  atualizadoEm: string;
  chartSetores: {
    labels: string[];
    pendentes: number[];
    atrasadas: number[];
    andamento: number[];
  };
}
