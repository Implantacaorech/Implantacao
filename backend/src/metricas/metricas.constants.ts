import type { Etapa } from '../common/constants/perfis';

// Campos obrigatórios por etapa — bloqueiam o avanço se vazios. Espelha
// webapp/db.py:CAMPOS_OBRIGATORIOS (nomes de campo em camelCase, para bater com Projeto).
export const CAMPOS_OBRIGATORIOS: Record<Etapa, string[]> = {
  Agendamento: [
    'cliente',
    'cnpj',
    'numeroProjeto',
    'modulos',
    'horasCobradas',
    'gci',
    'dataLevantamento',
  ],
  Levantamento: [
    'cliente',
    'cnpj',
    'numeroProjeto',
    'modulos',
    'horasCobradas',
    'gci',
    'dataLevantamento',
  ],
  Projeto: ['cliente', 'cnpj', 'numeroProjeto', 'modulos', 'horasCobradas'], // consultor é definido na Designação
  Designação: [
    'cliente',
    'cnpj',
    'numeroProjeto',
    'modulos',
    'horasCobradas',
    'consultor',
    'dataUsoOficial',
  ],
  'Cronograma e Check-list': [
    'cliente',
    'cnpj',
    'numeroProjeto',
    'modulos',
    'horasCobradas',
    'consultor',
    'dataUsoOficial',
  ],
  Encerramento: [
    'cliente',
    'cnpj',
    'numeroProjeto',
    'modulos',
    'horasCobradas',
    'consultor',
    'dataUsoOficial',
  ],
};

// Rótulos amigáveis para campos obrigatórios. Espelha webapp/db.py:CAMPO_LABELS.
export const CAMPO_LABELS: Record<string, string> = {
  cliente: 'Razão Social',
  cnpj: 'CNPJ',
  numeroProjeto: 'Nº do Projeto',
  numeroProposta: 'Nº da Proposta',
  ramo: 'Ramo de Atividade',
  responsavel: 'Responsável Administrativo',
  consultor: 'Consultor(es)',
  gci: 'GCI (Levantamento)',
  modulos: 'Módulos Contratados',
  horasCobradas: 'Horas Cobradas',
  horasBonificadas: 'Horas Bonificadas',
  dataInicio: 'Data de Início',
  dataLevantamento: 'Data do Levantamento',
  dataUsoOficial: 'Go-live Previsto',
  dataEncerramento: 'Data de Encerramento',
  contatoNome: 'Nome do Contato',
  contatoEmail: 'E-mail do Contato',
  contatoTel: 'Telefone do Contato',
  contatos: 'Contatos / Stakeholders',
  observacoes: 'Observações',
};

export type TipoDocumentoGate =
  'levantamento' | 'projeto' | 'cronograma' | 'termo' | 'checklist';

// Espelha webapp/db.py:DOC_LABELS.
export const DOC_LABELS: Record<string, string> = {
  levantamento: 'Mapeamento (Levantamento)',
  projeto: 'Projeto de Implantação',
  cronograma: 'Cronograma',
  termo: 'Termo de Encerramento',
  checklist: 'Check List',
};

// Documentos que já devem existir para o projeto estar (corretamente) na etapa. Acumulativo,
// encadeando a tríade obrigatória: Projeto · Cronograma · Termo. Espelha webapp/db.py:GATES.
export const GATES: Record<Etapa, TipoDocumentoGate[]> = {
  Agendamento: [],
  Levantamento: [],
  Projeto: ['levantamento'],
  Designação: ['levantamento', 'projeto'],
  'Cronograma e Check-list': ['levantamento', 'projeto'],
  Encerramento: ['levantamento', 'projeto', 'cronograma', 'checklist'],
};

export type ChaveAcaoEntrada =
  'gci_e_data_levantamento' | 'consultores_designacao' | 'consultores';

// Ações obrigatórias para ENTRAR em cada etapa (além dos documentos). Espelha
// webapp/db.py:ACAO_ENTRADA.
export const ACAO_ENTRADA: Partial<Record<Etapa, [ChaveAcaoEntrada, string]>> =
  {
    Levantamento: [
      'gci_e_data_levantamento',
      'Definir GCI e Data do Levantamento',
    ],
    Designação: ['consultores_designacao', 'Designar Consultores por Módulo'],
    'Cronograma e Check-list': ['consultores', 'Designar os Consultores'],
  };
