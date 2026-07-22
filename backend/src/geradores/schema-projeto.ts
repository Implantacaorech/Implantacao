/** Porte de `tools/schema_projeto.py` — estrutura canônica do Projeto de Implantação
 * (§4.2/§4.7 dos Padrões da Rech). Define as áreas, os grupos e os tokens usados pelo
 * gerador do Projeto. */

export interface AreaProjeto {
  id: string;
  grupo: string;
  subarea: string;
  subfields: string[];
}

const SUBCAMPOS_PADRAO = [
  'modulos',
  'detalhamento',
  'particularidade',
  'naoprevisto',
];

export const AREAS: AreaProjeto[] = [
  {
    id: 'vendas',
    grupo: 'Gestão Comercial',
    subarea: 'Vendas e Faturamento',
    subfields: SUBCAMPOS_PADRAO,
  },
  {
    id: 'estoque',
    grupo: 'Gestão de Materiais',
    subarea: 'Controle de Estoque',
    subfields: SUBCAMPOS_PADRAO,
  },
  {
    id: 'compras',
    grupo: 'Gestão de Materiais',
    subarea: 'Controle de Compras',
    subfields: SUBCAMPOS_PADRAO,
  },
  {
    id: 'industrial',
    grupo: 'Gestão da Produção',
    subarea: 'Gestão Industrial',
    subfields: SUBCAMPOS_PADRAO,
  },
  {
    // Controle Financeiro não tem "Não está previsto neste projeto".
    id: 'financeiro',
    grupo: 'Gestão Financeira',
    subarea: 'Controle Financeiro',
    subfields: ['modulos', 'detalhamento', 'particularidade'],
  },
  {
    id: 'livros',
    grupo: 'Gestão de Controladoria',
    subarea: 'Livros Fiscais',
    subfields: SUBCAMPOS_PADRAO,
  },
];

export const SECAO_APOS_ROTINAS = 'Responsabilidades na Execução do Projeto';

export const GRUPOS = [
  'Gestão Comercial',
  'Gestão de Materiais',
  'Gestão da Produção',
  'Gestão Financeira',
  'Gestão de Controladoria',
];

export const SUBAREAS = AREAS.map((a) => a.subarea);

/** Equipe Rech / Cliente (opcionais): chave no YAML e rótulo como aparece no documento. */
export const CAMPOS_EQUIPE: [string, string][] = [
  ['gerente', 'Gerente de Contas do Projeto:'],
  ['redator', 'Redator do Projeto:'],
  ['consultor', 'Consultor/Implantador:'],
  ['encarregado', 'Encarregado pelo Projeto:'],
];

/** Tokens "bloco": ocupam um parágrafo inteiro e cada linha do valor vira um bullet. */
export const TOKENS_BLOCO: Set<string> = new Set([
  'objetivos',
  'cad_clientes_fornecedores',
  'cad_produtos_servicos',
  'outros_pontos',
  ...AREAS.flatMap((a) => a.subfields.map((sf) => `${a.id}_${sf}`)),
]);
