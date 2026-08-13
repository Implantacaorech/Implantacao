/** Tipos do módulo Prontidão do Sistema (Sistema → Prontidão) — espelham o payload de
 * `GET /api/prontidao` (ver backend/src/prontidao). */

export type Severidade = 'critico' | 'alto' | 'medio' | 'baixo';
export type StatusAchado = 'corrigido' | 'mitigado' | 'aberto';

export interface EixoProntidao {
  numero: number;
  nome: string;
  /** 1 = ausente · 3 = funciona mas frágil · 5 = melhor prática com verificação automática. */
  maturidade: number;
  resumo: string;
}

export interface AchadoProntidao {
  codigo: string;
  titulo: string;
  severidade: Severidade;
  eixo: number;
  evidencia: string;
  correcao: string;
  status: StatusAchado;
  dono: string;
  prazo?: string;
}

export interface AvisoPrivacidadeVivo {
  finalidade: string;
  provider: string;
  viaEnv: boolean;
}

export interface Prontidao {
  dataAuditoria: string;
  eixos: EixoProntidao[];
  achados: AchadoProntidao[];
  totais: {
    porSeveridade: Record<Severidade, number>;
    porStatus: Record<StatusAchado, number>;
    maturidadeMedia: number;
  };
  privacidadeAoVivo: AvisoPrivacidadeVivo[];
}
