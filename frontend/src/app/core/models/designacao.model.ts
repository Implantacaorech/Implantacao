export interface DefinirGciView {
  gciAtual: string;
  gcis: string[];
}

export interface AgendarView {
  gci: string;
  dataLevantamento: string;
  hojeIso: string;
}

export interface ConsultoresView {
  modulos: string[];
  consultores: string[];
  atuais: Record<string, string>;
}
