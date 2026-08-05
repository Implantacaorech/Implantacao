export type Etapa =
  | 'Agendamento'
  | 'Levantamento'
  | 'Projeto'
  | 'Designação'
  | 'Cronograma e Check-list'
  | 'Encerramento';

export type Situacao = 'Em andamento' | 'Em risco' | 'Pausado' | 'Concluído';

/** NA ORDEM DO PROCESSO — espelha `ETAPAS` de backend/src/common/constants/perfis.ts, que é
 * a fonte da verdade. `Designação` vem antes de `Projeto` porque é assim que os 21 passos
 * correm: 8–9 são a Designação, 10–12 são o Projeto. As duas estavam invertidas até
 * 2026-08-05, o que fazia o Kanban e o stepper mostrarem o projeto REGREDINDO ao sair da
 * Designação. Mexer aqui exige mexer no backend junto. */
export const ETAPAS: Etapa[] = [
  'Agendamento',
  'Levantamento',
  'Designação',
  'Projeto',
  'Cronograma e Check-list',
  'Encerramento',
];

export const SITUACOES: Situacao[] = ['Em andamento', 'Em risco', 'Pausado', 'Concluído'];

/** Natureza da demanda aberta pelo Comercial no passo 1 — "Geração da demanda de
 * levantamento / demonstração" (docs/processo-implantacao.md §2.1.1). Espelha
 * TIPOS_DEMANDA de backend/src/common/constants/perfis.ts. */
export type TipoDemanda = 'Levantamento' | 'Demonstração';

export const TIPOS_DEMANDA: TipoDemanda[] = ['Levantamento', 'Demonstração'];

export interface Projeto {
  id: number;
  cliente: string;
  cnpj: string;
  numeroProjeto: string;
  numeroProposta: string;
  /** Levantamento ou Demonstração — escolhido no cadastro do cliente (passo 1). Vazio nos
   * projetos anteriores ao campo; só o cadastro grava, a ficha apenas exibe. */
  tipoDemanda: TipoDemanda | '';
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
