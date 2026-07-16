export type FormLegadoValor = string | string[];
export type TipoAcaoLegado = 'form_modulos' | 'criar_templates' | 'verbal' | 'saude' | 'import' | 'gerar';

export interface AcaoLegado {
  id: string;
  nome: string;
  tipo: TipoAcaoLegado;
  desc: string;
  gera?: 'checklist';
  mod?: string;
}

export interface RoleLegado {
  id: string;
  nome: string;
  icone: string;
  desc: string;
  acoes: AcaoLegado[];
}

// Espelha webapp/roles.py — catálogo estático (mesmo padrão do mapa.component.ts).
export const ROLES_LEGADO: RoleLegado[] = [
  {
    id: 'coordenacao',
    nome: 'Coordenação',
    icone: '🧭',
    desc: 'Orquestração e saúde do sistema.',
    acoes: [{ id: 'saude', nome: 'Saúde do Sistema', tipo: 'saude', desc: 'Roda o verificador e mostra o relatório.' }],
  },
  {
    id: 'adm',
    nome: 'Setor Adm',
    icone: '🗂️',
    desc: 'Levantamento e documentos.',
    acoes: [
      {
        id: 'criar',
        nome: 'Criação dos Templates',
        tipo: 'criar_templates',
        desc: 'Tela única (abas Dados comuns / Termo / Mapeamento) que gera o Termo de Encerramento e o Mapeamento de Processos.',
      },
      {
        id: 'importar',
        nome: 'Importar Levantamento → tudo',
        tipo: 'import',
        desc: 'Envie o Levantamento (.docx): gera em sequência o Projeto, o Check List do Consultor e o Termo — passando por tempo verbal + ortografia.',
      },
      {
        id: 'verbal',
        nome: 'Tempo Verbal e Ortografia',
        tipo: 'verbal',
        desc: 'Converte Presente→Futuro e corrige ortografia. Cole o texto OU envie um documento (.docx) para verificação.',
      },
    ],
  },
  {
    id: 'consultor',
    nome: 'Consultor de Implantação',
    icone: '🛠️',
    desc: 'Importação automática, projeto, termo e check list.',
    acoes: [
      {
        id: 'importar',
        nome: 'Importar Levantamento → tudo (automático)',
        tipo: 'import',
        desc: 'Envie o Levantamento (.docx): gera em sequência o Projeto, o Check List do Consultor e o Termo — passando por tempo verbal + ortografia. Não precisa abrir outra aba.',
      },
      {
        id: 'projeto',
        nome: 'Gerar Projeto de Implantação (manual)',
        tipo: 'gerar',
        mod: 'gerar_projeto_implantacao',
        desc: 'Gera só o Projeto, a partir do projeto.yaml (exemplo ou upload).',
      },
      {
        id: 'termo',
        nome: 'Gerar Termo de Encerramento (manual)',
        tipo: 'gerar',
        mod: 'gerar_termo_encerramento',
        desc: 'Gera só o Termo de Encerramento.',
      },
      {
        id: 'chkform',
        nome: 'Check List do Consultor (após o Projeto)',
        tipo: 'form_modulos',
        gera: 'checklist',
        desc: 'Selecione os módulos FINAIS (com inclusões/retiradas do levantamento) e gere a planilha-guia (Roteiro e Check List).',
      },
    ],
  },
];

// Geradores que usam o YAML do cliente (estrutura exemplo_cliente.yaml) — espelha
// webapp/roles.py:CLIENTE_BASE / usa_cliente().
const CLIENTE_BASE = new Set([
  'gerar_kit_mudanca',
  'gerar_roteiros_teste',
  'gerar_aceite_uat',
  'gerar_reconciliacao_conversao',
  'gerar_painel_hypercare',
  'gerar_log_fitgap',
  'gerar_painel_kpi',
  'gerar_raid',
  'gerar_dossie_cliente',
]);

export function getRole(rid: string): RoleLegado | undefined {
  return ROLES_LEGADO.find((r) => r.id === rid);
}

export function getAcao(rid: string, aid: string): AcaoLegado | undefined {
  return getRole(rid)?.acoes.find((a) => a.id === aid);
}

export function usaCliente(acao: AcaoLegado): boolean {
  return !!acao.mod && CLIENTE_BASE.has(acao.mod);
}

export interface CampoCliente {
  campo: string;
  rotulo: string;
  tipo: 'text' | 'date' | 'textarea';
  obrigatorio: boolean;
  dica: string;
}

// Espelha webapp/forms.py:CLIENTE_FIELDS.
export const CAMPOS_CLIENTE: CampoCliente[] = [
  { campo: 'nome', rotulo: 'Razão Social do cliente', tipo: 'text', obrigatorio: true, dica: 'Ex.: Indústria Alfa Ltda' },
  { campo: 'codigo_sicla', rotulo: 'Código no SICLA', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'rns_implantacao', rotulo: 'RNS de Implantação', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'usuario_lider', rotulo: 'Usuário líder (cliente)', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'contato_fone', rotulo: 'Contato / telefone', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'sigla', rotulo: 'Sigla (3 caracteres)', tipo: 'text', obrigatorio: false, dica: 'Ex.: A01' },
  { campo: 'cnpj', rotulo: 'CNPJ', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'data_virada_prevista', rotulo: 'Data prevista da virada', tipo: 'date', obrigatorio: false, dica: '' },
  { campo: 'consultor_responsavel', rotulo: 'Consultor responsável', tipo: 'text', obrigatorio: false, dica: '' },
  { campo: 'area', rotulo: 'Área de atuação', tipo: 'text', obrigatorio: false, dica: 'Ex.: Negócios e Produção' },
  { campo: 'numero_projeto', rotulo: 'Nº do projeto', tipo: 'text', obrigatorio: false, dica: '' },
  {
    campo: 'modulos',
    rotulo: 'Módulos (um por linha)',
    tipo: 'textarea',
    obrigatorio: false,
    dica: 'Estoque/Compras\nFiscal/Contábil\nFinanceiro\nFaturamento/Emissão',
  },
];

export interface ModuloCatalogo {
  codigo: number;
  abrev: string;
  descricao?: string;
  area: string;
}

export interface GrupoCatalogo {
  area: string;
  modulos: ModuloCatalogo[];
}

export interface ArquivoBaixavel {
  token: string;
  rotulo: string;
  nome: string;
}

export interface ResultadoFormModulos {
  ok: boolean;
  erro?: string;
  arquivo?: ArquivoBaixavel;
}

export interface ResultadoCriarTemplates {
  ok: boolean;
  erro?: string;
  arquivos: ArquivoBaixavel[];
}

export interface ResultadoVerbalTexto {
  depois: string;
  mudancas: [string, string][];
}

export interface ResultadoSaude {
  ok: boolean;
  relatorio: string;
}

export interface ResultadoGerar {
  ok: boolean;
  erro?: string;
  arquivo?: ArquivoBaixavel;
}

export interface ResultadoImportarSequencia {
  ok: boolean;
  erro?: string;
  cliente?: string;
  modulos?: number;
  arquivos: ArquivoBaixavel[];
}
