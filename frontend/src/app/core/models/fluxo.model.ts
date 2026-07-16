export interface StatusFluxo {
  imapConfigurado: boolean;
  smtpConfigurado: boolean;
  modeloFechamento: string;
}

export interface CamposFechamento {
  cliente?: string;
  cnpj?: string;
  ramo?: string;
  cidade?: string;
  contatoNome?: string;
  contatoEmail?: string;
  contatoTel?: string;
  numeroProjeto?: string;
  modulos?: string;
  horasCobradas?: string;
  horasBonificadas?: string;
  observacoes?: string;
}

export interface ResultadoParse {
  campos: CamposFechamento;
}

export interface ResultadoInbox {
  encontrado: boolean;
  erro?: string;
  assunto?: string;
  campos?: CamposFechamento;
}

export interface CriarFluxoPayload extends CamposFechamento {
  numeroProposta?: string;
  dataLevantamento?: string;
  dataUsoOficial?: string;
  contatos?: string;
  consultor?: string;
  tecnicos?: string;
  gerar?: string[];
  emailsResponsaveis?: string;
}

export interface ResultadoCriarFluxo {
  projetoId: number;
  duplicado: boolean;
  documentosGerados: string[];
  emailEnviado: boolean;
  avisoEmail?: string;
}

// Estado passado via router (history.state) de /fluxo para /fluxo/confirmar.
export interface EstadoFluxoConfirmar {
  campos: CamposFechamento;
  fonte: string;
  assunto?: string;
}
