/** SQL da consulta de RNS (SICLA.LISTA_ITEMPED) — tela Execução → RNS e a ficha de um
 * pedido, que a recorta pelo `envelopar` do catálogo em vez de duplicar o texto.
 *
 * `consulta_salva`: o que vale em produção é o texto de Sistema → Consultas BD. */

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
