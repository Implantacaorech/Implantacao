import { Projeto } from '../../core/models/projeto.model';

export type DocumentoConteudo = 'levantamento' | 'projeto';
export type TipoCampo = 'texto' | 'textarea' | 'ro';

export interface CampoSpec {
  chave: string;
  label: string;
  tipo: TipoCampo;
  origem: keyof Projeto | '';
}

export interface SecaoCampos {
  titulo: string;
  tipo?: undefined;
  campos: CampoSpec[];
}

export interface SecaoTabela {
  titulo: string;
  tipo: 'tabela';
  prefixo: string;
  linhas: number;
  colunas: [chave: string, label: string][];
}

export type Secao = SecaoCampos | SecaoTabela;

const SPEC: Record<DocumentoConteudo, { titulo: string; secoesBase: Secao[] }> = {
  levantamento: {
    titulo: 'Levantamento — edição estruturada',
    secoesBase: [
      {
        titulo: 'Identificação da empresa',
        campos: [
          { chave: 'razao_social', label: 'Razão Social', tipo: 'ro', origem: 'cliente' },
          { chave: 'ramo', label: 'Ramo de Atividade', tipo: 'texto', origem: 'ramo' },
          { chave: 'produto', label: 'Produto', tipo: 'texto', origem: '' },
          { chave: 'software_atual', label: 'Fornecedor Atual / Software', tipo: 'texto', origem: '' },
          { chave: 'filiais', label: 'Localização / Filiais', tipo: 'texto', origem: '' },
          { chave: 'objetivos', label: 'Observações / Objetivos', tipo: 'textarea', origem: 'observacoes' },
          { chave: 'qtd_usuarios', label: 'Quantidade de usuários e identificação', tipo: 'textarea', origem: '' },
        ],
      },
      {
        titulo: 'Usuários-chave',
        tipo: 'tabela',
        prefixo: 'usu',
        linhas: 5,
        colunas: [
          ['nome', 'Nome'],
          ['email', 'E-mail'],
          ['atrib', 'Atribuições'],
        ],
      },
      {
        titulo: 'Módulos e horas (do fechamento)',
        campos: [
          { chave: 'modulos', label: 'Módulos contratados', tipo: 'ro', origem: 'modulos' },
          { chave: 'horas_cobradas', label: 'Horas cobradas', tipo: 'ro', origem: 'horasCobradas' },
          { chave: 'horas_bonificadas', label: 'Horas bonificadas', tipo: 'ro', origem: 'horasBonificadas' },
        ],
      },
    ],
  },
  projeto: {
    titulo: 'Projeto de Implantação — edição estruturada',
    secoesBase: [
      {
        titulo: 'Cabeçalho',
        campos: [
          { chave: 'razao_social', label: 'Razão Social', tipo: 'ro', origem: 'cliente' },
          { chave: 'cnpj', label: 'CNPJ', tipo: 'texto', origem: 'cnpj' },
        ],
      },
      {
        titulo: 'Objetivos',
        campos: [{ chave: 'objetivos', label: 'Objetivos do projeto', tipo: 'textarea', origem: 'observacoes' }],
      },
      {
        titulo: 'Escopo',
        campos: [
          { chave: 'empresas', label: 'Empresas contempladas no projeto', tipo: 'textarea', origem: '' },
          { chave: 'conversoes', label: 'Conversões — detalhamento', tipo: 'textarea', origem: '' },
        ],
      },
      {
        titulo: 'Equipes',
        campos: [
          { chave: 'gerente_contas', label: 'Gerente de Contas (GCI)', tipo: 'texto', origem: 'gci' },
          { chave: 'redator', label: 'Redator do Projeto', tipo: 'texto', origem: '' },
          { chave: 'consultor', label: 'Consultor / Implantador', tipo: 'texto', origem: 'consultor' },
          { chave: 'encarregado', label: 'Encarregado pelo Projeto (cliente)', tipo: 'texto', origem: 'contatoNome' },
        ],
      },
      {
        titulo: 'Tabela de Usuários',
        tipo: 'tabela',
        prefixo: 'usu',
        linhas: 4,
        colunas: [
          ['nome', 'Nome'],
          ['email', 'E-mail'],
          ['area', 'Área de Atuação no SIGER'],
          ['assina', 'Assina Protocolo'],
        ],
      },
      {
        titulo: 'Cronograma Macro',
        campos: [
          { chave: 'crono_levantamento', label: 'Levantamento de requisitos — período', tipo: 'texto', origem: '' },
          { chave: 'crono_cronograma', label: 'Elaboração do Cronograma — período', tipo: 'texto', origem: '' },
          { chave: 'crono_parametrizacao', label: 'Parametrização — período', tipo: 'texto', origem: '' },
          { chave: 'crono_treinamento', label: 'Treinamento — período', tipo: 'texto', origem: '' },
          { chave: 'crono_simulacao', label: 'Simulação — período', tipo: 'texto', origem: '' },
          { chave: 'crono_inicio', label: 'Início do Uso oficial — período', tipo: 'texto', origem: '' },
          { chave: 'crono_finalizacao', label: 'Data estimada para Finalização — período', tipo: 'texto', origem: '' },
        ],
      },
      {
        titulo: 'Tempo estimado',
        campos: [
          { chave: 'horas_cobradas', label: 'Horas cobradas', tipo: 'ro', origem: 'horasCobradas' },
          { chave: 'horas_bonificadas', label: 'Horas bonificadas', tipo: 'ro', origem: 'horasBonificadas' },
        ],
      },
    ],
  },
};

// Áreas do "Detalhamento das Rotinas" do layout do Projeto — espelha _PROJ_AREAS de webapp/doc_edit.py.
const PROJ_AREAS: [chave: string, nome: string, siglas: string[]][] = [
  ['vendas', 'Vendas e Faturamento', ['FAT', 'PDV', 'OSE', 'SAC']],
  ['estoque', 'Controle de Estoque', ['EST']],
  ['compras', 'Controle de Compras', ['COM', 'TLO']],
  ['industrial', 'Gestão Industrial', ['GIN', 'GCA']],
  ['financeiro', 'Controle Financeiro', ['FIN', 'GCO']],
  ['fiscal', 'Livros Fiscais', ['LFI', 'CTB', 'GPA', 'AUE']],
];

function areasContratadas(projeto: Projeto): [chave: string, nome: string][] {
  const siglas = new Set(
    (projeto.modulos || '')
      .split(/[,;\n]+/)
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean),
  );
  return PROJ_AREAS.filter(([, , ss]) => ss.some((s) => siglas.has(s))).map(([k, nome]) => [k, nome]);
}

function detalhamentoSecoes(projeto: Projeto): SecaoCampos[] {
  return areasContratadas(projeto).map(([k, nome]) => ({
    titulo: `Detalhamento de Rotinas — ${nome}`,
    campos: [
      { chave: `det_${k}_modulos`, label: 'Módulos previstos', tipo: 'textarea', origem: '' },
      { chave: `det_${k}_detalhamento`, label: 'Detalhamento das rotinas atendidas', tipo: 'textarea', origem: '' },
      { chave: `det_${k}_particularidade`, label: 'Particularidade específica da área', tipo: 'textarea', origem: '' },
      { chave: `det_${k}_naoprevisto`, label: 'Não está previsto neste projeto', tipo: 'textarea', origem: '' },
    ],
  }));
}

export function titulo(doc: DocumentoConteudo): string {
  return SPEC[doc].titulo;
}

// Seções na ORDEM do layout: estáticas + dinâmicas por área (Projeto, logo após "Escopo").
export function secoes(doc: DocumentoConteudo, projeto: Projeto): Secao[] {
  const base = SPEC[doc].secoesBase;
  if (doc !== 'projeto') return base;
  const out: Secao[] = [];
  for (const sec of base) {
    out.push(sec);
    if (sec.titulo === 'Escopo') out.push(...detalhamentoSecoes(projeto));
  }
  return out;
}

// Chaves dos campos editáveis (não-ro) de um doc — espelha campos_editaveis() de webapp/doc_edit.py.
export function camposEditaveis(doc: DocumentoConteudo, projeto: Projeto): string[] {
  const out: string[] = [];
  for (const sec of secoes(doc, projeto)) {
    if (sec.tipo === 'tabela') out.push(...tabelaChaves(sec));
    else out.push(...sec.campos.filter((c) => c.tipo !== 'ro').map((c) => c.chave));
  }
  return out;
}

export function tabelaChaves(sec: SecaoTabela): string[] {
  const chaves: string[] = [];
  for (let i = 0; i < sec.linhas; i++) {
    for (const [ck] of sec.colunas) chaves.push(`${sec.prefixo}_${i}_${ck}`);
  }
  return chaves;
}

// Valor efetivo de cada campo: conteúdo salvo; senão o de origem do projeto.
export function valores(
  doc: DocumentoConteudo,
  projeto: Projeto,
  conteudo: Record<string, string>,
): Record<string, string> {
  const v: Record<string, string> = {};
  for (const sec of secoes(doc, projeto)) {
    if (sec.tipo === 'tabela') {
      for (const chave of tabelaChaves(sec)) v[chave] = conteudo[chave] || '';
    } else {
      for (const { chave, origem } of sec.campos) {
        let val = conteudo[chave];
        if (!val && origem) val = String(projeto[origem] ?? '');
        v[chave] = val || '';
      }
    }
  }
  return v;
}
