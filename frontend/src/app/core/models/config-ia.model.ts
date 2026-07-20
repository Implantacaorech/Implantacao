export type ProvedorIa = 'anthropic' | 'openrouter';

export interface StatusFinalidadeIa {
  finalidade: string;
  rotulo: string;
  descricao: string;
  ativa: boolean;
  provider: ProvedorIa;
  modelo: string;
  viaEnv: boolean;
}

export interface StatusConfigIa {
  provedores: ProvedorIa[];
  finalidades: StatusFinalidadeIa[];
}

export interface SalvarChaveIa {
  finalidade: string;
  provider: ProvedorIa;
  apiKey: string;
  modelo: string;
}
