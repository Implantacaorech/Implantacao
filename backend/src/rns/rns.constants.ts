import { textoAparado } from '../common/utils/texto.util';

/** A consulta da tela RNS como CONSULTA NOMEADA do Consultas BD (Sistema → Consulta BD):
 * o serviço semeia o SQL padrão abaixo sob este slug no boot e passa a usar a versão
 * gravada lá — o Administrador edita a consulta pelo painel, sem deploy (mesmo desenho da
 * `lista_tecnicos_sicla` do cadastro de Usuários). */
export const SLUG_CONSULTA_RNS = 'rns_lista_itemped';
export const NOME_CONSULTA_RNS = 'RNS — Consulta de assuntos (LISTA_ITEMPED)';

/** Teto de linhas de uma consulta. Quando bate o teto, o serviço marca `truncado` e a tela
 * pede para estreitar o período — melhor do que estourar o payload em silêncio. */
export const LIMITE_CONSULTA_RNS = 5000;

/** Uma RNS (item PAI de `LISTA_ITEMPED`) já normalizada. `pedido` + `item` são a identidade
 * que o consultor usa ("RNS 138643/1"); o resto é o contexto que a tela mostra no detalhe,
 * nos mesmos grupos do SELECT. */
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

/** Número de verdade ou null — nunca 0 por engano: `Number(null)` é 0 e gravaria "pedido 0"
 * onde a view mandou vazio. */
function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normaliza uma linha CRUA de `LISTA_ITEMPED` (chaves em qualquer caixa, valores de
 * qualquer tipo) para `LinhaRns`. Campos de rótulo passam por `textoAparado` — o que não
 * for escalar vira '', nunca "[object Object]". */
export function normalizarLinhaRns(bruta: Record<string, unknown>): LinhaRns {
  const l: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bruta)) l[(k || '').toUpperCase()] = v;
  return {
    pedido: numeroOuNull(l.PEDIDO),
    item: numeroOuNull(l.ITEM),
    codigo: numeroOuNull(l.CODIGO),
    cliente: numeroOuNull(l.CLIENTE),
    status: textoAparado(l.STATUS),
    sugestao: textoAparado(l.SUGESTAO),
    tipo: textoAparado(l.TIPO),
    subtipo: textoAparado(l.SUBTIPO),
    projeto: textoAparado(l.PROJETO),
    prioridadeA: textoAparado(l.PRIORIDADEA),
    prioridade: numeroOuNull(l.PRIORIDADE),
    prioridadeAna: textoAparado(l.PRIORIDADE_ANA),
    disponivel: textoAparado(l.DISPONIVEL),
    temReq: textoAparado(l.TEMREQ),
    tipoDes: textoAparado(l.TIPODES),
    statusDes: textoAparado(l.STATUSDES),
    statusPubDes: textoAparado(l.STATUSPUBDES),
    backlogDes: textoAparado(l.BACKLOGDES),
    faseDes: textoAparado(l.FASEDES),
    requisitoDes: textoAparado(l.REQUISITODES),
    dataCri: textoAparado(l.DATACRI).slice(0, 10),
    dataDesejada: textoAparado(l.DATADESEJADA).slice(0, 10),
    dataPrevista: textoAparado(l.DATAPREVISTA).slice(0, 10),
    dataPrevFimProd: textoAparado(l.DATAPREVFIMPROD).slice(0, 10),
    dataStatus8: textoAparado(l.DATASTATUS8).slice(0, 10),
    dataStatus10: textoAparado(l.DATASTATUS10).slice(0, 10),
    diasTriagem: numeroOuNull(l.DIAS_TRIAGEM),
    resNome: textoAparado(l.RESNOME),
    sigla: textoAparado(l.SIGLA),
    fantasia: textoAparado(l.FANTASIA),
    visaoGeral: textoAparado(l.VISAOGERAL),
    contato: textoAparado(l.CONTATO),
    versaoAtu: textoAparado(l.VERSAOATU),
    versaoLib: textoAparado(l.VERSAOLIB),
    minVerGeracao: textoAparado(l.MINVERGERACAO),
    anaNome: textoAparado(l.ANANOME),
    valCoordenadorDes: textoAparado(l.VALCOORDENADORDES),
    valTecnicoDes: textoAparado(l.VALTECNICODES),
    valGrupoDes: textoAparado(l.VALGRUPODES),
    funcaoDes: textoAparado(l.FUNCAODES),
    represenDes: textoAparado(l.REPRESENDES),
    productOwnerDes: textoAparado(l.PRODUCTOWNERDES),
    celula: textoAparado(l.CELULA),
    menu: textoAparado(l.MENU),
    turnosPrev: numeroOuNull(l.TURNOSPREV),
    timeDes: textoAparado(l.TIMEDES),
    pontos: numeroOuNull(l.PONTOS),
    protocolo: textoAparado(l.PROTOCOLO),
    rnsFilhas: textoAparado(l.RNSFILHAS),
    valorCob: numeroOuNull(l.VALOR_COB),
    detalhamento: textoAparado(l.DETALHAMENTO),
    motivo: textoAparado(l.MOTIVO),
    parecerEng: textoAparado(l.PARECERENG),
  };
}
