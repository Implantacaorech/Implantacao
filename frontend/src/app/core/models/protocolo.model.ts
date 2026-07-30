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
  menusAbordados: string;
  funcionalidades: string;
  passoAPasso: string;
  processos: string;
  definicoes: string;
  regrasNegocio: string;
  configuracoes: string;
  dependencias: string;
  pontosAtencao: string;
  exemplos: string;
  duvidas: string;
  pendenciasTreinamento: string;
  proximosPassos: string;
  resumoTecnico: string;
  resumoCompleto: string;
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
  podeExcluir: boolean;
}

export interface FichaProtocolo {
  protocolo: Protocolo;
  podeAprovar: boolean;
  podeExcluir: boolean;
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
  | 'menusAbordados'
  | 'funcionalidades'
  | 'passoAPasso'
  | 'processos'
  | 'definicoes'
  | 'regrasNegocio'
  | 'configuracoes'
  | 'dependencias'
  | 'pontosAtencao'
  | 'exemplos'
  | 'duvidas'
  | 'pendenciasTreinamento'
  | 'proximosPassos'
  | 'resumoTecnico'
  | 'resumoCompleto'
  | 'assuntosRemovidos'
  | 'pendencias';

/** Campos de texto da revisão, na ordem das seções do protocolo de treinamento. `grupo`
 * só marca o início de um bloco na tela (o formulário é uma lista só). `resumoCompleto`
 * fica FORA desta lista de propósito — tem painel próprio no fim da ficha (ver
 * protocolo-ficha.component.html). */
export const PROTO_CAMPOS_EDICAO: { chave: CampoTextoProtocolo; rotulo: string; linhas: number; grupo?: string }[] = [
  { chave: 'resumo', rotulo: 'Resumo geral (executivo)', linhas: 5, grupo: '1. Resumo' },
  { chave: 'objetivo', rotulo: 'Objetivo da rotina', linhas: 3 },
  { chave: 'quandoUtilizar', rotulo: 'Quando utilizar', linhas: 3 },
  { chave: 'preRequisitos', rotulo: 'Pré-requisitos', linhas: 3 },
  { chave: 'menusAbordados', rotulo: 'Menus do sistema abordados (menu · objetivo · atividades)', linhas: 10, grupo: '2. Conteúdo do treinamento' },
  { chave: 'funcionalidades', rotulo: 'Funcionalidades demonstradas', linhas: 8 },
  { chave: 'passoAPasso', rotulo: 'Passo a passo consolidado', linhas: 8 },
  { chave: 'processos', rotulo: 'Processos executados', linhas: 5 },
  { chave: 'definicoes', rotulo: 'Definições explicadas no treinamento', linhas: 6, grupo: '3. Conceitos, regras e configurações' },
  { chave: 'regrasNegocio', rotulo: 'Regras de negócio', linhas: 4 },
  { chave: 'configuracoes', rotulo: 'Configurações e parametrizações', linhas: 5 },
  { chave: 'dependencias', rotulo: 'Dependências', linhas: 3 },
  { chave: 'pontosAtencao', rotulo: 'Pontos de atenção', linhas: 3 },
  { chave: 'exemplos', rotulo: 'Exemplos citados', linhas: 3 },
  { chave: 'duvidas', rotulo: 'Dúvidas respondidas (P / R)', linhas: 5, grupo: '4. Fechamento' },
  { chave: 'pendenciasTreinamento', rotulo: 'Pendências do treinamento (com o cliente)', linhas: 4 },
  { chave: 'proximosPassos', rotulo: 'Próximos passos', linhas: 4 },
  { chave: 'resumoTecnico', rotulo: 'Resumo técnico final (tópicos)', linhas: 5 },
  { chave: 'assuntosRemovidos', rotulo: 'Assuntos removidos pela filtragem', linhas: 3, grupo: '5. Auditoria da análise' },
  { chave: 'pendencias', rotulo: 'Pontos a validar na revisão (levantados pela IA)', linhas: 3 },
];
