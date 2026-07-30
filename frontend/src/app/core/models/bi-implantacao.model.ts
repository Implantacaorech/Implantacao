/** Espelha o payload de `GET /bi-implantacao/resumo` (backend BiImplantacaoService).
 * Porte da página "Resumo Implantação" do BI `BI_clientes.pbix` (Power BI). */

export interface LinhaResumoBi {
  codigo: number;
  cliente: number | null;
  descricao: string;
  fantasia: string;
  tecnico: string;
  /** `TIPOSTATUS` da view — o "Status_RNS" do relatório original. */
  statusRns: string;
  tipo: number | null;
  dataContratacao: string;
  dataPrevUso: string;
  dataEncerramento: string;
  horasPrevistas: number;
  horasRealizadas: number;
  horasSaldo: number;
  horasCobradas: number;
  horasBonificadas: number;
  grupoEconomico: string;
  ativoDes: string;
  tipoDes: string;
}

export interface TotaisResumoBi {
  quantidade: number;
  horasPrevistas: number;
  horasRealizadas: number;
  /** Soma da coluna `HORASALDO` do SICLA. */
  horasSaldo: number;
  /** `previstas - realizadas` — é este o saldo que o card SALDO do BI mostra. */
  horasSaldoCalculado: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
}

export interface AgrupamentoBi {
  chave: string;
  quantidade: number;
  horasPrevistas: number;
  horasRealizadas: number;
  horasSaldo: number;
}

/** Opção do filtro de RNS: o valor é o código, o rótulo mostra de quem é. */
export interface OpcaoRnsBi {
  codigo: string;
  rotulo: string;
}

export interface FiltrosBi {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  ativos: string[];
  tiposCliente: string[];
  rns: OpcaoRnsBi[];
}

export interface SelecaoBi {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  ativos: string[];
  tiposCliente: string[];
  rns: string[];
}

export interface ResultadoResumoBi {
  periodo: { inicio: string; fim: string };
  linhas: LinhaResumoBi[];
  totais: TotaisResumoBi;
  porStatus: AgrupamentoBi[];
  porTecnico: AgrupamentoBi[];
  filtros: FiltrosBi;
  selecionados: SelecaoBi;
  erro: string | null;
}

export interface FiltroResumoBi {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  status?: string[];
  tecnico?: string[];
  ativo?: string[];
  tipoCliente?: string[];
  rns?: string[];
}

// ── Página "Extrato de Protocolo/Horas" ───────────────────────────────────────────────

export interface LinhaExtratoBi {
  rns: number;
  cliente: number | null;
  protocolo: number | null;
  data: string;
  hora: string;
  sigla: string;
  tecnico: string;
  /** `LIS_DESCRICAO` — assunto curto do protocolo. */
  assunto: string;
  sistema: string;
  /** Prévia de `DESC_VISITA` (300 caracteres). */
  descricao: string;
  descricaoTamanho: number;
  descricaoTruncada: boolean;
  /** Valor absoluto — a view grava o consumo como negativo. */
  horasUtilizadas: number;
  saldoAcumulado: number;
  fantasia: string;
  grupoEconomico: string;
  /** Status da RNS de implantação (join com POWERBI_IMPLANTACAO_RESUMO). */
  statusRns: string;
  rnsDescricao: string;
}

export interface TotaisExtratoBi {
  lancamentos: number;
  horasUtilizadas: number;
  saldoAtual: number | null;
}

export interface FiltrosExtratoBi {
  grupos: string[];
  tecnicos: string[];
  siglas: string[];
  clientes: string[];
  status: string[];
  rns: OpcaoRnsBi[];
}

export interface SelecaoExtratoBi {
  grupos: string[];
  tecnicos: string[];
  siglas: string[];
  clientes: string[];
  status: string[];
  rns: string[];
}

export interface ResultadoExtratoBi {
  periodo: { inicio: string; fim: string };
  linhas: LinhaExtratoBi[];
  totais: TotaisExtratoBi;
  filtros: FiltrosExtratoBi;
  selecionados: SelecaoExtratoBi;
  truncado: boolean;
  erro: string | null;
}

export interface FiltroExtratoBi {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  tecnico?: string[];
  sigla?: string[];
  cliente?: string[];
  status?: string[];
  rns?: string[];
}

export interface DescricaoCompletaBi {
  descricao: string;
  tamanho: number;
  erro: string | null;
}

// ── Página "RNS" (vinculadas às implantações) ─────────────────────────────────────────

export interface LinhaRnsBi {
  codigo: number;
  /** `PEDIDO-ITEM`, como o SICLA identifica a RNS. */
  rns: string;
  pedido: number;
  item: number;
  dataCriacao: string;
  statusRns: string;
  sigla: string;
  sistema: string;
  visaoGeral: string;
  versoesGeracao: string;
  validadaCliente: boolean;
  tipo: string;
  responsavel: string;
  analista: string;
  cliente: number | null;
  fantasia: string;
  rnsImplantacao: number;
  descricaoImplantacao: string;
  statusImplantacao: string;
  tecnico: string;
  grupoEconomico: string;
}

export interface TotaisRnsBi {
  quantidade: number;
  validadas: number;
  naoValidadas: number;
  implantacoes: number;
}

export interface ContagemRnsBi {
  chave: string;
  quantidade: number;
}

export interface FiltrosRnsBi {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  siglas: string[];
  tipos: string[];
  statusImplantacao: string[];
  rns: OpcaoRnsBi[];
}

export interface SelecaoRnsBi {
  grupos: string[];
  status: string[];
  tecnicos: string[];
  siglas: string[];
  tipos: string[];
  statusImplantacao: string[];
  rns: string[];
  validada: string;
}

export interface ResultadoRnsBi {
  periodo: { inicio: string; fim: string };
  linhas: LinhaRnsBi[];
  totais: TotaisRnsBi;
  porStatus: ContagemRnsBi[];
  porSigla: ContagemRnsBi[];
  filtros: FiltrosRnsBi;
  selecionados: SelecaoRnsBi;
  erro: string | null;
}

export interface FiltroRnsBi {
  dataIni?: string;
  dataFim?: string;
  grupo?: string[];
  status?: string[];
  tecnico?: string[];
  sigla?: string[];
  tipo?: string[];
  statusImplantacao?: string[];
  rns?: string[];
  validada?: string;
}

// ── Página "Agendas" (calendário mensal) ──────────────────────────────────────────────

export interface LinhaAgendaBi {
  codigo: number;
  rnsImplantacao: number;
  dia: string;
  horaIni: string;
  horaFim: string;
  /** Status EFETIVO: visita apontada força "6-Realizada". */
  status: string;
  statusOriginal: string;
  especie: number;
  especieDes: string;
  /** Nomes individuais — a view guarda "Fulano,Beltrano" numa coluna só. */
  participantes: string[];
  responsavel: string;
  cliente: number | null;
  clienteFantasia: string;
  assunto: string;
  horasDuracao: number;
  observacao: string;
  turno: string;
  statusImplantacao: string;
  tecnicoImplantacao: string;
  descricaoImplantacao: string;
  grupoEconomico: string;
}

export interface DiaAgendaBi {
  dia: string;
  numero: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  agendas: LinhaAgendaBi[];
  /** Total do dia ANTES da regra de prioridade. */
  totalNoDia: number;
}

export interface ResumoStatusAgendaBi {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

export interface FiltrosAgendasBi {
  grupos: string[];
  tecnicos: string[];
  statusImplantacao: string[];
  status: string[];
  rns: OpcaoRnsBi[];
}

export interface SelecaoAgendasBi {
  grupos: string[];
  tecnicos: string[];
  statusImplantacao: string[];
  status: string[];
  rns: string[];
}

export interface ResultadoAgendasBi {
  mes: string;
  dias: DiaAgendaBi[];
  resumo: ResumoStatusAgendaBi[];
  totalAgendas: number;
  filtros: FiltrosAgendasBi;
  selecionados: SelecaoAgendasBi;
  erro: string | null;
}

export interface FiltroAgendasBi {
  mes?: string;
  grupo?: string[];
  tecnico?: string[];
  status?: string[];
  statusImplantacao?: string[];
  rns?: string[];
}
