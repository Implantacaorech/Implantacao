export type Etapa =
  | 'Agendamento'
  | 'Levantamento'
  | 'Projeto'
  | 'Designação'
  | 'Cronograma e Check-list'
  | 'Encerramento';

export type Situacao = 'Em andamento' | 'Em risco' | 'Pausado' | 'Concluído';

export const ETAPAS: Etapa[] = [
  'Agendamento',
  'Levantamento',
  'Projeto',
  'Designação',
  'Cronograma e Check-list',
  'Encerramento',
];

export const SITUACOES: Situacao[] = ['Em andamento', 'Em risco', 'Pausado', 'Concluído'];

export interface Projeto {
  id: number;
  cliente: string;
  cnpj: string;
  numeroProjeto: string;
  numeroProposta: string;
  ramo: string;
  responsavel: string;
  consultor: string;
  gci: string;
  etapa: Etapa;
  situacao: Situacao;
  dataInicio: string;
  dataLevantamento: string;
  dataUsoOficial: string;
  dataEncerramento: string;
  horasCobradas: string;
  horasBonificadas: string;
  modulos: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTel: string;
  /** E-mail do Comercial que abriu o cliente — destinatário do passo 3. */
  comercialEmail: string;
  contatos: string;
  observacoes: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type CriarProjetoPayload = Partial<Omit<Projeto, 'id' | 'criadoEm' | 'atualizadoEm'>> & {
  cliente: string;
};

export type AtualizarProjetoPayload = Partial<CriarProjetoPayload>;
