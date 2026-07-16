export interface ModeloEmailRenderizado {
  nome: string;
  assunto: string;
  corpo: string;
}

export interface TelaEmailProjeto {
  cliente: string;
  destinoPadrao: string;
  configurado: boolean;
  tpls: Record<string, ModeloEmailRenderizado>;
}

export interface ResultadoEnvioEmailProjeto {
  enviado: boolean;
  erro?: string;
}
