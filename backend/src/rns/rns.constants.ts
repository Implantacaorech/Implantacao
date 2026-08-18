import { textoAparado } from '../common/utils/texto.util';

/** A consulta da tela RNS como CONSULTA NOMEADA do Consultas BD (Sistema → Consulta BD):
 * o serviço semeia o SQL padrão abaixo sob este slug no boot e passa a usar a versão
 * gravada lá — o Administrador edita a consulta pelo painel, sem deploy (mesmo desenho da
 * `lista_tecnicos_sicla` do cadastro de Usuários). */
export const SLUG_CONSULTA_RNS = 'rns_lista_itemped';
export const NOME_CONSULTA_RNS = 'RNS — Consulta de assuntos (LISTA_ITEMPED)';

/** Tela **Execução → RNS** — consulta de assuntos nas RNS do SICLA.
 *
 * Fonte: `SICLA.LISTA_ITEMPED` (a view de pedidos/itens de RNS do SICLA), lida pela MESMA
 * conexão Oracle da Disponibilidade — o idioma das outras leituras do SICLA (BI, Agenda,
 * Usuários). O SELECT abaixo é o DEFAULT embutido — a versão vigente é a do Consultas BD
 * (`SLUG_CONSULTA_RNS`) — e é o SELECT do usuário (revisão de 2026-08-17: + `DETALHAMENTO`,
 * `MOTIVO`, `PARECERENG`; SEM o filtro `PEDIDOPAI IS NULL` — pais E filhas na lista; o
 * `VISAOGERAL` duplicado da revisão foi mantido uma vez só), com três adaptações mecânicas:
 *
 * 1. prefixo de schema `SICLA.` (a conexão configurada lê `SICLA.LISTA_CLIENTES`/
 *    `LISTA_TECNICOS` assim — sem depender de sinônimo do usuário Oracle);
 * 2. as datas fixas do `BETWEEN` viraram binds `:data_ini`/`:data_fim` (fim INCLUSIVE,
 *    implementado como `< :data_fim + 1` — mesmo efeito do `23:59:59` original);
 * 3. as colunas DATE saem por `TO_CHAR(..., 'YYYY-MM-DD')` para o formato no fio ser
 *    estável (mesma decisão de `SQL_CALENDARIO_ALOCACAO`).
 *
 * O ORDER BY é o da consulta original (ordem de backlog/prioridade do SICLA) e usa colunas
 * fora do SELECT (`BACKLOGTIP`, `DATAPREVISTAORD`) — válido porque lê a view diretamente. */
export const SQL_CONSULTA_RNS_PADRAO = `-- Consulta da tela Execução → RNS (semeada pelo Painel; editável aqui).
-- :data_ini/:data_fim são supridos automaticamente: pela janela "Criadas de/até" da tela
-- RNS e, no Testar desta tela, por uma janela genérica de 1 ano. Mantenha os dois binds —
-- sem eles a tela RNS perde o filtro de período. Datas devem sair como texto AAAA-MM-DD
-- (TO_CHAR) e os nomes das colunas devem ser mantidos: são o contrato com a tela.
SELECT
  ITM.CLIENTE,
  ITM.STATUS,
  ITM.SUGESTAO,
  ITM.TIPO,
  ITM.SUBTIPO,
  ITM.CODIGO,
  ITM.PROJETO,
  ITM.PRIORIDADEA,
  ITM.PRIORIDADE,
  ITM.PRIORIDADE_ANA,
  ITM.DISPONIVEL,
  ITM.TEMREQ,
  ITM.PEDIDO,
  ITM.ITEM,
  ITM.TIPODES,
  ITM.STATUSDES,
  ITM.STATUSPUBDES,
  ITM.BACKLOGDES,
  ITM.FASEDES,
  ITM.REQUISITODES,
  TO_CHAR(ITM.DATACRI, 'YYYY-MM-DD')         AS DATACRI,
  TO_CHAR(ITM.DATADESEJADA, 'YYYY-MM-DD')    AS DATADESEJADA,
  TO_CHAR(ITM.DATAPREVISTA, 'YYYY-MM-DD')    AS DATAPREVISTA,
  TO_CHAR(ITM.DATAPREVFIMPROD, 'YYYY-MM-DD') AS DATAPREVFIMPROD,
  TO_CHAR(ITM.DATASTATUS8, 'YYYY-MM-DD')     AS DATASTATUS8,
  TO_CHAR(ITM.DATASTATUS10, 'YYYY-MM-DD')    AS DATASTATUS10,
  ITM.DIAS_TRIAGEM,
  ITM.RESNOME,
  ITM.SIGLA,
  ITM.FANTASIA,
  ITM.VISAOGERAL,
  ITM.CONTATO,
  ITM.VERSAOATU,
  ITM.VERSAOLIB,
  ITM.MINVERGERACAO,
  ITM.ANANOME,
  ITM.VALCOORDENADORDES,
  ITM.VALTECNICODES,
  ITM.VALGRUPODES,
  ITM.FUNCAODES,
  ITM.REPRESENDES,
  ITM.PRODUCTOWNERDES,
  ITM.CELULA,
  ITM.MENU,
  ITM.TURNOSPREV,
  ITM.TIMEDES,
  ITM.PONTOS,
  ITM.PROTOCOLO,
  ITM.RNSFILHAS,
  ITM.VALOR_COB,
  ITM.DETALHAMENTO,
  ITM.MOTIVO,
  ITM.PARECERENG
FROM SICLA.LISTA_ITEMPED ITM
WHERE ITM.DATACRI >= TO_DATE(:data_ini, 'YYYY-MM-DD')
  AND ITM.DATACRI <  TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
ORDER BY
  ITM.BACKLOGTIP DESC,
  ITM.BACKLOGDES,
  COALESCE(ITM.PRIORIDADE, 99999),
  ITM.STATUS,
  ITM.DATAPREVISTAORD,
  ITM.DATACRI DESC,
  ITM.CODIGO DESC`;

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
