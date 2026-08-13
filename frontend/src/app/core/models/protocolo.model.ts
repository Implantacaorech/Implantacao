export type VideoOrigem = 'sharepoint' | 'upload' | 'gravacao';

export type StatusProtocolo =
  | 'Gravando'
  | 'Pendente'
  | 'Transcrevendo'
  | 'Analisando'
  | 'Em revisão'
  | 'Aprovado'
  | 'Reprovado / Ajustar'
  | 'Erro';

export const PROTO_STATUS: StatusProtocolo[] = [
  'Gravando',
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

export const ROTULO_ORIGEM: Record<VideoOrigem, string> = {
  sharepoint: 'SharePoint',
  upload: 'Upload manual',
  gravacao: 'Reunião gravada',
};

export interface Protocolo {
  id: number;
  /** Projeto (cliente) a que o protocolo foi direcionado — nulo quando é genérico. */
  projetoId: number | null;
  cliente: string;
  /** Quantas vozes a transcrição separou (0 = não separou). */
  participantes: number;
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
  cliente?: string;
}

/** Um cliente devolvido pela busca no SICLA — a MESMA consulta do Novo Cliente (passo 1).
 * `codigo` é o código do cliente no SICLA; não há id de projeto aqui, porque a reunião pode
 * acontecer antes de a implantação existir no painel. */
export interface ClienteProtocolo {
  codigo: string;
  cliente: string;
  fantasia: string;
  cnpj: string;
}

export interface BuscaClientesProtocolo {
  ok: boolean;
  mensagem: string;
  clientes: ClienteProtocolo[];
}

/** Andamento da gravação em curso, consultado pela tela a cada poucos segundos. */
export interface EstadoGravacao {
  /** O transcritor terminou de carregar o modelo? Antes disso o texto demora a aparecer. */
  pronto: boolean;
  duracaoSeg: number;
  trechos: number;
  pendentes: number;
  texto: string;
  erro: string | null;
}

export interface IniciarGravacaoPayload {
  /** Só quando a gravação foi aberta de dentro de um projeto (botão do Levantamento). */
  projetoId?: number;
  clienteCodigo?: string;
  cliente?: string;
  cnpj?: string;
  titulo?: string;
  /** Nomes dos participantes e termos da reunião — viram `hotwords` do transcritor. */
  vocabulario?: string;
  /** Quantas pessoas vão falar. >= 2 liga a separação de locutores; 0 ou 1 desliga. */
  participantes?: number;
  fonte: 'microfone' | 'reuniao' | 'ambos';
}

export interface GravacaoIniciada {
  id: number;
  cliente: string;
  titulo: string;
}

export interface GravacaoFinalizada {
  id: number;
  duracaoSeg: number;
  aviso: string;
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
  /** Rótulos de locutor presentes na transcrição (`P1`, `P2`…), na ordem em que falam.
   * Vazio quando a gravação não separou vozes. */
  locutores: string[];
  /** Nomes já definidos: `{ P1: 'Ivian' }`. */
  mapaLocutores: Record<string, string>;
}

/** Um cliente que já tem protocolo transcrito — alimenta o seletor do "Preencher
 * protocolo". `total` é quantos protocolos aquele cliente tem. */
export interface ClienteComProtocolo {
  cliente: string;
  clienteCodigo: string;
  total: number;
}

/** Rascunho de uma ATIVIDADE do "Registro de Atendimento em Visita" do Portal Rech,
 * montado de um protocolo (transcrição/gravação). Espelha `RascunhoVisita` do backend. */
export interface RascunhoVisita {
  protocoloId: number;
  cliente: string;
  clienteCodigo: string;
  tituloProtocolo: string;
  participantes: string[];
  dataInicioSugerida: string | null;
  dataFimSugerida: string | null;
  duracaoSeg: number;
  origem: VideoOrigem;
  status: StatusProtocolo;
  atividade: {
    modulo: string;
    menu: string;
    descricaoAtividade: string;
  };
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
