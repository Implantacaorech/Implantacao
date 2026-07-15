export interface ConfigDisponibilidade {
  tipo: string;
  host: string;
  porta: string;
  banco: string;
  usuario: string;
  url: string;
  select: string;
  selectTecnicos: string;
  oracleLibDir: string;
  ativo: boolean;
  oracleThick: boolean;
}

export type StatusConfigDisponibilidade = ConfigDisponibilidade & { configurado: boolean };

export type SalvarConfigDisponibilidadePayload = Partial<ConfigDisponibilidade> & { senha?: string };

export interface LinhaOcupacao {
  tecnico: string;
  data: string;
  turno: '' | 'manha' | 'tarde';
}

export interface ResultadoTesteDisponibilidade {
  ok: boolean;
  mensagem: string;
  amostra: LinhaOcupacao[];
}
