/** Teto de linhas trazidas do Oracle. A view tinha ~1.9k linhas no total em 2026-07-29;
 * 5000 dá folga sem risco de puxar o banco inteiro para a memória do processo. */
export const LIMITE_LINHAS = 5000;

/** Janela padrão quando a tela não manda período: últimos 12 meses. Vale para TODAS as
 * páginas do BI (decisão do usuário em 2026-07-29 — o extrato chegou a abrir com 6 meses e
 * causou estranheza por divergir do resumo). */
export const MESES_PADRAO = 12;

/** Uma RNS de implantação, já normalizada para o frontend. */
export interface LinhaResumo {
  codigo: number;
  cliente: number | null;
  descricao: string;
  fantasia: string;
  tecnico: string;
  statusRns: string;
  tipo: number | null;
  dataContratacao: string;
  dataPrevUso: string;
  dataEncerramento: string;
  horasPrevistas: number;
  horasRealizadas: number;
  /** Coluna `HORASALDO` da view — o saldo como o SICLA o registra. */
  horasSaldo: number;
  /** `HORASCOBRADAS` + `HORASCOBRADASADICIONAIS` (o BI soma as duas). */
  horasCobradas: number;
  /** `HORABONIFICADAS` + `HORABONIFICADASADICIONAIS` (idem). */
  horasBonificadas: number;
  grupoEconomico: string;
  ativoDes: string;
  tipoDes: string;
}

export interface TotaisResumo {
  quantidade: number;
  horasPrevistas: number;
  horasRealizadas: number;
  /** Soma da coluna `HORASALDO`. */
  horasSaldo: number;
  /** `previstas - realizadas`. É ESTE o saldo que a medida `Grafico_Horas_HTML` do Power BI
   * mostra no card SALDO — ela não usa a coluna `HORASALDO`. Os dois convivem de propósito:
   * a tabela detalhada exibe o dado do SICLA, o painel de horas reproduz o BI. */
  horasSaldoCalculado: number;
  horasCobradas: number;
  horasBonificadas: number;
  /** % de consumo das horas previstas (0–100+, null quando não há previsão). */
  percentualUtilizacao: number | null;
}

/** Agregado por uma dimensão (status, técnico, grupo) — alimenta o gráfico de horas. */
export interface AgrupamentoResumo {
  chave: string;
  quantidade: number;
  horasPrevistas: number;
  horasRealizadas: number;
  horasSaldo: number;
}

// ── Página "Extrato de Protocolo/Horas" ───────────────────────────────────────────────

/** Teto de linhas do extrato — mais volumoso que o resumo (10.111 lançamentos no total).
 * Em 12 meses são ~6,5 mil lançamentos, então o teto ainda dá folga. */
export const LIMITE_LINHAS_EXTRATO = 10000;

/** Um lançamento de horas do extrato. */
export interface LinhaExtrato {
  rns: number;
  cliente: number | null;
  protocolo: number | null;
  data: string;
  hora: string;
  sigla: string;
  tecnico: string;
  /** `LIS_DESCRICAO` — o assunto curto do protocolo. */
  assunto: string;
  sistema: string;
  /** Trecho de `DESC_VISITA` (até `TRECHO_DESCRICAO` caracteres). */
  descricao: string;
  /** Tamanho REAL da descrição — maior que o trecho ⇒ há texto a buscar sob demanda. */
  descricaoTamanho: number;
  descricaoTruncada: boolean;
  /** Valor ABSOLUTO de `LISHORASUTILIZADAS` (a view grava negativo). */
  horasUtilizadas: number;
  saldoAcumulado: number;
  fantasia: string;
  grupoEconomico: string;
  /** `TIPOSTATUS` da RNS de implantação (vem do join com POWERBI_IMPLANTACAO_RESUMO). */
  statusRns: string;
  /** Descrição da RNS de implantação — rotula a RNS nas listas de filtro. */
  rnsDescricao: string;
}

export interface TotaisExtrato {
  lancamentos: number;
  horasUtilizadas: number;
  /** Saldo acumulado do lançamento mais recente do recorte (o saldo "de agora"). */
  saldoAtual: number | null;
}

// ── Página "RNS" (RNS vinculadas às implantações) ─────────────────────────────────────

/** Uma RNS vinculada a uma implantação. */
export interface LinhaRns {
  codigo: number;
  /** Número da RNS como o SICLA a identifica: `PEDIDO-ITEM`. */
  rns: string;
  pedido: number;
  item: number;
  dataCriacao: string;
  statusRns: string;
  sigla: string;
  sistema: string;
  visaoGeral: string;
  versoesGeracao: string;
  /** `VALIDADOCLI`: 1 = validada pelo cliente, 0 = não. */
  validadaCliente: boolean;
  tipo: string;
  responsavel: string;
  analista: string;
  cliente: number | null;
  fantasia: string;
  /** RNS de implantação a que esta RNS está vinculada (`IMP_COD`). */
  rnsImplantacao: number;
  descricaoImplantacao: string;
  statusImplantacao: string;
  tecnico: string;
  grupoEconomico: string;
}

export interface TotaisRns {
  quantidade: number;
  validadas: number;
  naoValidadas: number;
  /** Quantas implantações distintas têm RNS vinculada no recorte. */
  implantacoes: number;
}

// ── Página "Agendas" (calendário mensal) ──────────────────────────────────────────────

/** Cores por status — as da medida `Calendario` vigente (pastel). Uma versão ANTIGA do
 * calendário, achada num script TMDL solto dentro do .pbix, usava cores fortes; são as
 * pastel que valem. */
export const COR_STATUS_AGENDA: Record<string, string> = {
  '1-Solicitada': '#FFFFE0',
  '3-Agendada': '#E0FFE0',
  '6-Realizada': '#FFF5E0',
  '7-Não realizada': '#F5DEB3',
  '8-Postergada': '#F0F0F0',
  '9-Cancelada': '#FFE0E0',
};

/** Uma agenda já normalizada. */
export interface LinhaAgenda {
  codigo: number;
  rnsImplantacao: number;
  dia: string;
  horaIni: string;
  horaFim: string;
  /** Status EFETIVO: `VISITA` preenchida força "6-Realizada" (regra do DAX). */
  status: string;
  statusOriginal: string;
  especie: number;
  especieDes: string;
  /** Nomes individuais — `PARTICIPANTES` vem como "Fulano,Beltrano". */
  participantes: string[];
  responsavel: string;
  cliente: number | null;
  clienteFantasia: string;
  assunto: string;
  horasDuracao: number;
  observacao: string;
  /** Manhã | Tarde | Noite — pelo horário de início, como no DAX. */
  turno: string;
  statusImplantacao: string;
  tecnicoImplantacao: string;
  descricaoImplantacao: string;
  grupoEconomico: string;
}

export interface DiaAgenda {
  dia: string;
  /** Dia do mês (1..31). */
  numero: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  agendas: LinhaAgenda[];
  /** Quantas agendas o dia tem antes da regra de prioridade. */
  totalNoDia: number;
}

export interface ResumoStatusAgenda {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

// ── Painel "Visitas do Portal Rech" (Resumo, abaixo do CONTROLE DE HORAS) ─────────────

/** A consulta do painel como CONSULTA NOMEADA do Consultas BD (Sistema → Consulta BD):
 * semeada no boot com o default abaixo e editável pelo Administrador sem deploy (mesmo
 * desenho da `rns_lista_itemped`). Diferente das demais, roda com `conexao = 'portal'` —
 * o BANCO DO PORTAL RECH (MySQL), cadastrado na mesma tela. */
export const SLUG_CONSULTA_VISITAS_PORTAL = 'bi_visitas_portal';
export const NOME_CONSULTA_VISITAS_PORTAL =
  'BI — Visitas do Portal Rech (aprovação)';
export const CONEXAO_CONSULTA_VISITAS_PORTAL = 'portal';

/** Teto de linhas trazidas do banco do Portal — folga larga para o volume real
 * (~5 mil visitas no total em 2026-08-17). */
export const LIMITE_VISITAS_PORTAL = 20000;

/** Uma visita do Portal já normalizada — os campos seguem os ALIASES do SELECT. */
export interface LinhaVisitaPortal {
  empresa: string;
  /** `CODIGO_CLIENTE` = código do cliente no SICLA — chave com que a tela casa a visita
   * com o cliente filtrado nos demais filtros do Resumo. */
  cliente: number | null;
  contato: string;
  consultor: string;
  /** O `v.ID` do Portal — o nº de protocolo que o time usa (faixa 130.000+). */
  protocolo: number | null;
  /** AAAA-MM-DD (ou '' quando a coluna vier vazia). */
  data: string;
  /** HH:MM:SS, como a consulta devolve. */
  horario: string;
  /** MANHÃ | TARDE | NOITE | FORA DO TURNO (calculado no SQL). */
  turno: string;
  /** 'Sim' | 'Com ressalva' | 'Não', como o SQL devolve — texto, não boolean, para a
   * edição da consulta no Consultas BD poder mudar o rótulo sem quebrar a tela.
   * Interpretado por `situacaoVisita`. */
  aprovado: string;
}

/** As três situações de aprovação, como o Portal registra em `visita_aprovacao.APROVADO`:
 * `1` = aprovada · `0` = aprovada COM RESSALVA (lá a justificativa é obrigatória) ·
 * `NULL` = o cliente ainda não respondeu. */
export type SituacaoVisita = 'sim' | 'ressalva' | 'nao';

/** Lê o RÓTULO que a consulta devolveu (e não o código do banco — o texto é escolhido no
 * Consultas BD, e o Administrador pode reescrevê-lo). Só 'Sim' e 'Com ressalva' são
 * reconhecidos nominalmente; qualquer outro valor — inclusive a visita ainda sem resposta
 * do cliente — cai em 'nao', que é o que mantém o painel vivo se o rótulo mudar. */
export function situacaoVisita(aprovado: string): SituacaoVisita {
  const s = (aprovado || '').trim().toLowerCase();
  if (s === 'sim') return 'sim';
  if (s === 'com ressalva') return 'ressalva';
  return 'nao';
}
