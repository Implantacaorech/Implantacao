/** Vocabulário e calibração do Consultor SIGER — valores validados no protótipo de
 * 2026-08-18 (F:\CONSULTOR-SIGER): 7/7 perguntas reais de implantação com confiança ALTA.
 * A base consultada é DERIVADA (SQLite gerado pelo indexador fora deste repositório);
 * a fonte original `F:\SIGER` é somente leitura e nunca é tocada pelo Painel. */

export type VisaoConsulta = 'funcional' | 'tecnica';
export type ConfiancaConsulta = 'alta' | 'media' | 'baixa' | 'nao_confirmado';
export type AcaoConsulta =
  'funcionamento' | 'configuracao' | 'cadastros' | 'diagnostico' | 'processo';

export interface FonteEvidencia {
  arquivo: string;
  linha: number;
  versao: string;
  referencia: string;
  tipo: string;
}

export interface ItemSecao {
  texto: string;
  fonte: FonteEvidencia;
}

export interface AssuntoRelacionado {
  titulo: string;
  pesquisa: string;
}

export interface InterpretacaoPergunta {
  acao: AcaoConsulta;
  termos: string[];
  termosExpandidos: string[];
}

export interface RespostaConsultorSiger {
  pergunta: string;
  visao: VisaoConsulta;
  /** `false` = a base derivada não está acessível neste ambiente (a tela explica como gerar). */
  disponivel: boolean;
  interpretacao: InterpretacaoPergunta | null;
  /** Seções na ordem de leitura da implantação; só entram as que têm evidência. */
  secoes: Record<string, ItemSecao[]>;
  assuntosRelacionados: AssuntoRelacionado[];
  sugestoes: string[];
  fontes: FonteEvidencia[];
  confianca: ConfiancaConsulta;
  aviso: string | null;
}

export interface StatusConsultorSiger {
  disponivel: boolean;
  caminho: string;
  entidades: number;
  chunks: number;
  /** Última geração da base (mtime do arquivo), ISO — null com base indisponível. */
  atualizadoEm: string | null;
  versaoCobol: string;
  versaoAtual: string;
}

/** Versões da fonte na base derivada atual (ver decisão pendente de ACL no diagnóstico). */
export const VERSAO_COBOL = '23.10b';
export const VERSAO_ATUAL = '26.20a';

export const STOPWORDS = new Set(
  (
    'a o e de da do das dos em no na nos nas um uma para por com sem sobre como qual ' +
    'quais que quando onde porque preciso necessario necessarios devo ser estar sao ao ' +
    'aos meu minha este esta isso funciona utilizar usar fazer posso consigo cliente ' +
    'sistema siger processo'
  ).split(' '),
);

/** Termo do consultor → termos extras de busca (vocabulário do domínio SIGER). */
export const SINONIMOS: Record<string, string[]> = {
  nota: ['nota fiscal', 'nf', 'faturamento'],
  nf: ['nota fiscal', 'faturamento', 'emissao'],
  nfe: ['nota fiscal', 'nf-e', 'faturamento', 'danfe'],
  faturar: ['faturamento', 'nota fiscal', 'pedido'],
  faturamento: ['nota fiscal', 'pedido', 'fat'],
  emitir: ['emissao', 'gerar'],
  pedido: ['pedidos', 'manutencao de pedidos'],
  compras: ['compra', 'fornecedor', 'pedido de compra', 'com'],
  estoque: ['saldo', 'movimento', 'est'],
  baixa: ['movimentacao', 'saida', 'movimento'],
  financeiro: ['contas a receber', 'contas a pagar', 'duplicata', 'fin'],
  bloqueia: ['bloqueio', 'validacao', 'mensagem', 'impede', 'erro'],
  bloqueio: ['validacao', 'mensagem', 'erro'],
  erro: ['mensagem', 'validacao', 'bloqueio'],
  parametro: ['parametros', 'configuracao'],
  parametros: ['parametro', 'configuracao'],
  configurar: ['configuracao', 'parametro', 'parametros'],
  configuracao: ['parametro', 'parametros'],
  cadastro: ['cadastros', 'manutencao'],
  cadastros: ['cadastro', 'manutencao'],
  cancelamento: ['cancelar', 'estorno'],
  devolucao: ['retorno', 'devolucoes'],
  natureza: ['natureza de operacao', 'cfop'],
  tributacao: ['imposto', 'icms', 'ipi', 'fiscal'],
  produto: ['produtos', 'nprodu'],
  transportador: ['transportadora', 'frete'],
  orcamento: ['orcamentos', 'retirada'],
  boleto: ['cobranca', 'boletos'],
  serie: ['series', 'documento'],
};

/** Detecção de intenção — a PRIMEIRA que casar vence (diagnóstico antes de configuração:
 * "por que não consigo configurar X" é um problema, não um pedido de configuração). */
export const ACOES: Array<[AcaoConsulta, RegExp]> = [
  [
    'diagnostico',
    /por que|porque|n[aã]o (consigo|consegue|deixa|permite|fatura|emite)|bloqueia|bloqueado|travad|erro|problema/,
  ],
  [
    'configuracao',
    /configurar|configura[çc][aã]o|parametrizar|par[âa]metro|o que preciso (para|configurar)|habilitar/,
  ],
  [
    'cadastros',
    /cadastros? (s[aã]o )?necess[áa]rios|quais cadastros|o que cadastrar/,
  ],
  [
    'processo',
    /todo o processo|processo completo|entender o processo|fluxo|o que acontece/,
  ],
  ['funcionamento', /como funciona|o que [ée]|para que serve/],
];

/** Multiplicador de relevância por tipo de fonte, conforme a intenção. O `bm25()` do FTS5
 * é NEGATIVO (mais negativo = mais relevante): a pontuação é DIVIDIDA pelo peso — peso < 1
 * aproxima do topo, peso > 1 afasta. Calibrado no protótipo (o sinal invertido do bm25 foi
 * um defeito real encontrado lá — não "simplificar" isto para multiplicação). */
export const PESOS: Record<AcaoConsulta, Record<string, number>> = {
  funcionamento: {
    help: 0.35,
    menu: 0.65,
    tela: 0.7,
    historico: 1.2,
    modulo: 0.5,
    changelog: 1.05,
    tabela: 0.85,
  },
  configuracao: {
    parametro: 0.4,
    menu: 0.6,
    help: 0.5,
    tela_validacao: 0.75,
    tabela: 0.85,
    changelog: 1.05,
    historico: 1.2,
  },
  cadastros: {
    tabela: 0.45,
    menu: 0.55,
    help: 0.6,
    tela: 0.7,
    historico: 1.25,
  },
  diagnostico: {
    mensagens: 0.4,
    tela_validacao: 0.5,
    codigo: 0.75,
    help: 0.6,
    changelog: 0.8,
    historico: 1.0,
  },
  processo: { help: 0.45, menu: 0.6, modulo: 0.5, historico: 1.15, tela: 0.75 },
};

/** Trechos de "menu" que são instrução interna do programa de menus, não opção real. */
export const RUIDO_MENU =
  /caractere corresponde|op[çc][aã]o de \d|tabela de op[çc][oõ]es/i;

/** Módulos de programas específicos por cliente — não valem como regra geral do SIGER. */
export const MODULOS_CLIENTE = new Set([
  'NOT',
  'TOP',
  'TOA',
  'ETG',
  'FTC',
  'LPR',
  'EXP',
]);

/** Tipos de fonte que contam como evidência DIRETA para o nível de confiança. */
export const TIPOS_FORTES = new Set([
  'help',
  'tela_validacao',
  'mensagens',
  'parametro',
  'codigo',
  'tabela',
]);

/** Ordem de apresentação das seções (prioridade de leitura na implantação). */
export const ORDEM_SECOES = [
  'resumo',
  'comoFunciona',
  'regrasValidacoes',
  'configuracoes',
  'cadastros',
  'telasMenus',
  'alteracoesRecentes',
  'origemTecnica',
] as const;
