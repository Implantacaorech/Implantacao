import { Etapa, Projeto } from './projeto.model';

export interface Alerta {
  nivel: 'alto' | 'medio';
  projetoId: number;
  cliente: string;
  tipo: string;
  msg: string;
}

export interface ItemStepper {
  nome: Etapa;
  estado: 'done' | 'atual' | 'futuro';
}

export interface ProximaAcao {
  tipo: string;
  label: string;
  ok: boolean;
}

export interface ItemGate {
  tipo: string;
  label: string;
  ok: boolean;
}

export interface GateStatus {
  etapa: Etapa;
  itens: ItemGate[];
  faltam: string[];
  ok: boolean;
}

export interface CampoFaltante {
  campo: string;
  label: string;
}

export interface Cabecalho {
  stepper: ItemStepper[];
  fase: Etapa;
  etapa: Etapa;
  goLive: string;
  atraso: number | null;
  horasCob: number;
  horasBon: number;
  horasTotal: number;
  docsOk: number;
  docsTotal: number;
  proxima: ProximaAcao | null;
  proxEtapa: Etapa | null;
  avancarOk: boolean;
  gate: GateStatus;
  camposFaltantes: CampoFaltante[];
  bloqueios: string[];
}

export interface FocoHome {
  projeto: Projeto;
  cabecalho: Cabecalho;
}

export interface DadosHome {
  ativos: number;
  noPrazo: number;
  atrasados: number;
  alertas: number;
  risco: number;
  total: number;
  concluidos: number;
  gatePendente: number;
}

export interface ItemPendenciaHome {
  id: number;
  cliente: string;
  fase: string;
  atraso: number | null;
  acao: string;
  tipo: string;
}

export interface PainelHome {
  dados: DadosHome;
  alertas: Alerta[];
  pendencias: ItemPendenciaHome[];
  foco: FocoHome | null;
}
