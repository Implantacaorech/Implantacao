/** Tela Execução → RNS — consulta de assuntos nas RNS do SICLA (`SICLA.LISTA_ITEMPED`).
 * Espelha `GET /rns` (backend `rns/rns.constants.ts`). `pedido` + `item` são a identidade
 * que o consultor usa ("RNS 138643/1"); o resto é o contexto mostrado no detalhe. */

export interface LinhaRns {
  // Pedido / Item — a identidade
  pedido: number | null;
  item: number | null;
  codigo: number | null;
  // Identificação / classificação
  cliente: number | null;
  status: string;
  sugestao: string;
  tipo: string;
  subtipo: string;
  projeto: string;
  prioridadeA: string;
  prioridade: number | null;
  prioridadeAna: string;
  // Disponibilidade / requisição
  disponivel: string;
  temReq: string;
  // Descrições / status
  tipoDes: string;
  statusDes: string;
  statusPubDes: string;
  backlogDes: string;
  faseDes: string;
  requisitoDes: string;
  // Datas (AAAA-MM-DD ou '')
  dataCri: string;
  dataDesejada: string;
  dataPrevista: string;
  dataPrevFimProd: string;
  dataStatus8: string;
  dataStatus10: string;
  diasTriagem: number | null;
  // Cliente / produto
  resNome: string;
  sigla: string;
  fantasia: string;
  visaoGeral: string;
  contato: string;
  // Versões
  versaoAtu: string;
  versaoLib: string;
  minVerGeracao: string;
  // Responsáveis
  anaNome: string;
  valCoordenadorDes: string;
  valTecnicoDes: string;
  valGrupoDes: string;
  funcaoDes: string;
  represenDes: string;
  productOwnerDes: string;
  // Organização / produção
  celula: string;
  menu: string;
  turnosPrev: number | null;
  timeDes: string;
  pontos: number | null;
  // Protocolo / RNS
  protocolo: string;
  rnsFilhas: string;
  // Outros
  valorCob: number | null;
  detalhamento: string;
  motivo: string;
  parecerEng: string;
}

export interface ResultadoConsultaRns {
  ini: string;
  fim: string;
  /** Já na ordem de backlog/prioridade do SICLA — a tela não reordena. */
  itens: LinhaRns[];
  total: number;
  limite: number;
  /** Bateu no teto de linhas — há mais RNS no período do que o que veio. */
  truncado: boolean;
  erro: string | null;
}

/** Resumo completo de UMA RNS (`GET /rns/detalhe`) — todos os itens do pedido, em ordem
 * de item. É o que o modal do calendário da Agenda mostra ao clicar num compromisso. */
export interface ResultadoDetalheRns {
  numero: number;
  itens: LinhaRns[];
  total: number;
  erro: string | null;
}
