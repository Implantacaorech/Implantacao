export interface LinhaAtraso {
  id: number;
  cliente: string;
  etapa: string;
  consultor: string;
  dias: number;
}

export interface LinhaRisco {
  id: number;
  cliente: string;
  etapa: string;
}

export interface LinhaConsultorCarga {
  consultor: string;
  projetos: number;
  horas: number;
}

export interface ResultadoMetricas {
  total: number;
  ativos: number;
  concluidos: number;
  porSituacao: Record<string, number>;
  porEtapa: Record<string, number>;
  atrasados: LinhaAtraso[];
  nAtrasados: number;
  emRisco: LinhaRisco[];
  nRisco: number;
  gatePendente: number;
  noPrazo: number;
  consultores: LinhaConsultorCarga[];
  horasCob: number;
  horasBon: number;
  horasTotal: number;
  ttvMedio: number | null;
}

export interface Alerta {
  nivel: 'alto' | 'medio';
  projetoId: number;
  cliente: string;
  tipo: string;
  msg: string;
}

export interface PainelCoordenacao {
  m: ResultadoMetricas;
  alertas: Alerta[];
  etapas: readonly string[];
  situacoes: readonly string[];
}

export interface ResultadoDigest {
  ok: boolean;
  mensagem: string;
}
