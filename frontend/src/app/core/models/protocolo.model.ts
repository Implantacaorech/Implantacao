export type VideoOrigem = 'sharepoint' | 'upload';

export type StatusProtocolo =
  | 'Pendente'
  | 'Transcrevendo'
  | 'Analisando'
  | 'Em revisão'
  | 'Aprovado'
  | 'Reprovado / Ajustar'
  | 'Erro';

export const PROTO_STATUS: StatusProtocolo[] = [
  'Pendente',
  'Transcrevendo',
  'Analisando',
  'Em revisão',
  'Aprovado',
  'Reprovado / Ajustar',
  'Erro',
];

export const PROTO_MODULOS = [
  'Fiscal',
  'Estoque',
  'Financeiro',
  'Comercial',
  'Produção',
  'Contábil',
  'Compras',
  'WMS',
  'Folha de Pagamento',
  'Implantação',
  'Consultoria',
  'Módulo a validar',
] as const;

export interface Protocolo {
  id: number;
  titulo: string;
  modulo: string;
  menu: string;
  assunto: string;
  resumo: string;
  objetivo: string;
  quandoUtilizar: string;
  preRequisitos: string;
  passoAPasso: string;
  configuracoes: string;
  dependencias: string;
  regrasNegocio: string;
  pontosAtencao: string;
  exemplos: string;
  assuntosRemovidos: string;
  pendencias: string;
  videoNome: string;
  videoCaminho: string;
  videoOrigem: VideoOrigem;
  videoHash: string;
  duracaoSeg: number;
  transcricao: string;
  textoIa: string;
  status: StatusProtocolo;
  logErro: string;
  historico: string;
  responsavel: string;
  aprovador: string;
  criadoEm: string;
  processadoEm: string | null;
  aprovadoEm: string | null;
}

export interface FiltroProtocolos {
  modulo?: string;
  menu?: string;
  status?: string;
  q?: string;
  origem?: string;
}

export interface ListaProtocolos {
  itens: Protocolo[];
  roboOk: boolean;
  pasta: string;
}

export interface FichaProtocolo {
  protocolo: Protocolo;
  podeAprovar: boolean;
  ehAudio: boolean;
}

export interface StatusProcessamento {
  status: StatusProtocolo;
  pct: number | null;
  pos: number;
  dur: number;
}

export type CampoTextoProtocolo =
  | 'titulo'
  | 'modulo'
  | 'menu'
  | 'assunto'
  | 'resumo'
  | 'objetivo'
  | 'quandoUtilizar'
  | 'preRequisitos'
  | 'passoAPasso'
  | 'configuracoes'
  | 'dependencias'
  | 'regrasNegocio'
  | 'pontosAtencao'
  | 'exemplos'
  | 'assuntosRemovidos'
  | 'pendencias';

export const PROTO_CAMPOS_EDICAO: { chave: CampoTextoProtocolo; rotulo: string; linhas: number }[] = [
  { chave: 'resumo', rotulo: 'Resumo do treinamento', linhas: 4 },
  { chave: 'objetivo', rotulo: 'Objetivo da rotina', linhas: 3 },
  { chave: 'quandoUtilizar', rotulo: 'Quando utilizar', linhas: 3 },
  { chave: 'preRequisitos', rotulo: 'Pré-requisitos', linhas: 4 },
  { chave: 'passoAPasso', rotulo: 'Passo a passo', linhas: 8 },
  { chave: 'configuracoes', rotulo: 'Configurações envolvidas', linhas: 4 },
  { chave: 'dependencias', rotulo: 'Dependências', linhas: 3 },
  { chave: 'regrasNegocio', rotulo: 'Regras de negócio', linhas: 4 },
  { chave: 'pontosAtencao', rotulo: 'Pontos de atenção', linhas: 3 },
  { chave: 'exemplos', rotulo: 'Exemplos citados', linhas: 3 },
  { chave: 'assuntosRemovidos', rotulo: 'Assuntos removidos (auditoria)', linhas: 3 },
  { chave: 'pendencias', rotulo: 'Pendências de validação', linhas: 3 },
];
