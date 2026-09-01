/** SQL dos painéis de BI sobre o SICLA — resumo de implantações, extrato de horas,
 * descrição de um lançamento, RNS vinculadas, indicadores por competência e movimentos
 * agregados. Todos `fixo`, exceto a previsão de início oficial (`consulta_salva`, semeada
 * em Sistema → Consultas BD e conferida pelo Administrador contra a view real). */

/** Quantos caracteres da descrição vêm na LISTAGEM. `DESC_VISITA` é um CLOB que chega a
 * ~71 mil caracteres; num recorte de 12 meses são ~6,5 mil lançamentos, então cada 1.000
 * caracteres por linha viram ~6 MB de resposta. O relatório original mostrava 60 caracteres
 * na lista e o resto num modal — aqui a lista recebe 300 (dá para uma prévia de 2 linhas) e
 * o texto completo vem sob demanda em `SQL_EXTRATO_DESCRICAO`, ao abrir o item.
 *
 * O teto do `DBMS_LOB.SUBSTR` é em BYTES (VARCHAR2): com acentos em UTF-8, pedir 4.000
 * caracteres estoura com ORA-06502. Por isso o texto completo vem em blocos de 8.000 bytes. */
export const TRECHO_DESCRICAO = 300;

/** SQL da tela "Resumo de Implantação" — porte da página homônima do BI `BI_clientes.pbix`
 * (Power BI) para dentro do Painel.
 *
 * Origem: view `POWERBI.POWERBI_IMPLANTACAO_RESUMO` (Oracle SICLA, schema POWERBI — o mesmo
 * usuário/conexão já configurado na aba Disponibilidade). O join com `SICLA.LISTA_CLIENTES`
 * repõe o que no modelo do Power BI era a tabela `LISTA_CLIENTES`: o GRUPO ECONÔMICO
 * (`GRECONDES`) e os filtros de situação/tipo do cliente (`ATIVODES`/`TIPODES`).
 *
 * Equivalências com o relatório original (para quem for comparar as duas telas):
 *   BI `Status_RNS`       → `TIPOSTATUS`  (ex.: "6-Concluída", "5-Uso Oficial")
 *   BI `GRUPO_ECONOMICO`  → `LISTA_CLIENTES.GRECONDES`
 *   BI `RNImp`            → `CODIGO` (o número da RNS de implantação)
 *
 * Os binds `:data_ini`/`:data_fim` são obrigatórios no texto (o driver não aceita bind não
 * referenciado); passar `null` nos dois desliga o recorte de período. */
export const SQL_RESUMO_IMPLANTACAO = `SELECT
  r.CODIGO,
  r.CLIENTE,
  r.DESCRICAO,
  r.FANTASIA,
  r.TECNICO,
  r.TIPOSTATUS            AS STATUS_RNS,
  r.TIPO,
  TO_CHAR(r.DATACONTRATACAO,  'YYYY-MM-DD') AS DATA_CONTRATACAO,
  TO_CHAR(r.DATAPREVUSO,      'YYYY-MM-DD') AS DATA_PREV_USO,
  TO_CHAR(r.DATAENCERRAMENTO, 'YYYY-MM-DD') AS DATA_ENCERRAMENTO,
  r.HORASPREVISTAS,
  r.HORASREALIZADAS,
  r.HORASALDO,
  r.HORASCOBRADAS,
  r.HORASCOBRADASADICIONAIS,
  r.HORABONIFICADAS,
  r.HORABONIFICADASADICIONAIS,
  c.GRECONDES             AS GRUPO_ECONOMICO,
  c.ATIVODES,
  c.TIPODES
FROM POWERBI.POWERBI_IMPLANTACAO_RESUMO r
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = r.CLIENTE
WHERE (:data_ini IS NULL OR r.DATACONTRATACAO >= TO_DATE(:data_ini, 'YYYY-MM-DD'))
  AND (:data_fim IS NULL OR r.DATACONTRATACAO <  TO_DATE(:data_fim, 'YYYY-MM-DD') + 1)
-- Recorte por CLIENTE (docs/acesso-cliente-bi.md §7). Quem manda o bind é o Painel, a partir
-- do vínculo do usuário logado — nunca o navegador. É defesa em PROFUNDIDADE: a garantia
-- continua sendo o filtro do serviço, que roda sobre o resultado; este bind existe para o
-- dado alheio não sair do Oracle. Nulo = sem recorte (todo usuário interno).
  AND (:cliente IS NULL OR r.CLIENTE = :cliente)
ORDER BY r.DATACONTRATACAO DESC NULLS LAST, r.CODIGO DESC`;

/** Extrato de horas por lançamento (protocolo). Espelha a origem da medida
 * `Tabela_Resumo_HTML` do BI: `POWERBI_IMPLANTACAO_EXTRATO_HORAS` ordenada por `DATAHORA`
 * decrescente. `LISHORASUTILIZADAS` é gravado NEGATIVO no SICLA (é consumo) — o relatório
 * mostra o valor absoluto, e o serviço faz o mesmo. */
export const SQL_EXTRATO_HORAS = `SELECT
  e.IMP_COD,
  e.IMP_CLIENTE,
  e.PROTOCOLO,
  TO_CHAR(e.DATAHORA, 'YYYY-MM-DD') AS DATA,
  TO_CHAR(e.DATAHORA, 'HH24:MI')    AS HORA,
  e.LIS_SIGLA,
  e.LIS_TECNICODESCRICAO,
  e.LIS_DESCRICAO,
  e.SISTEMADESCRICAO,
  DBMS_LOB.SUBSTR(e.DESC_VISITA, ${TRECHO_DESCRICAO}, 1) AS DESCRICAO,
  DBMS_LOB.GETLENGTH(e.DESC_VISITA)                      AS DESCRICAO_TAMANHO,
  e.LISHORASUTILIZADAS,
  e.SALDO_ACUMULADO,
  c.FANTASIA,
  c.GRECONDES AS GRUPO_ECONOMICO,
  r.TIPOSTATUS AS STATUS_RNS,
  r.DESCRICAO  AS RNS_DESCRICAO
FROM POWERBI.POWERBI_IMPLANTACAO_EXTRATO_HORAS e
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = e.IMP_CLIENTE
-- Junta o RESUMO para trazer o STATUS da RNS de implantação: o extrato sozinho não tem essa
-- informação, e ela é um dos filtros padrão das telas do BI.
LEFT JOIN POWERBI.POWERBI_IMPLANTACAO_RESUMO r ON r.CODIGO = e.IMP_COD
WHERE (:data_ini IS NULL OR e.DATAHORA >= TO_DATE(:data_ini, 'YYYY-MM-DD'))
  AND (:data_fim IS NULL OR e.DATAHORA <  TO_DATE(:data_fim, 'YYYY-MM-DD') + 1)
-- Recorte por CLIENTE (docs/acesso-cliente-bi.md §7). Quem manda o bind é o Painel, a partir
-- do vínculo do usuário logado — nunca o navegador. É defesa em PROFUNDIDADE: a garantia
-- continua sendo o filtro do serviço, que roda sobre o resultado; este bind existe para o
-- dado alheio não sair do Oracle. Nulo = sem recorte (todo usuário interno).
  AND (:cliente IS NULL OR e.IMP_CLIENTE = :cliente)
ORDER BY e.DATAHORA DESC`;

/** Texto completo de UM lançamento — buscado só quando o usuário abre a descrição.
 * A chave é composta (protocolo + data/hora) porque o protocolo sozinho pode repetir.
 *
 * `IMP_CLIENTE` não é exibido: ele existe para o serviço poder conferir DE QUEM é o
 * lançamento antes de devolver o texto. Sem essa coluna, o endpoint aceitava qualquer par
 * protocolo+data/hora e entregava a descrição da visita — que é texto escrito pelo
 * consultor — a quem pedisse, bastando variar o número (docs/acesso-cliente-bi.md §5). */
export const SQL_EXTRATO_DESCRICAO = `SELECT
  DBMS_LOB.SUBSTR(e.DESC_VISITA, 8000, 1) AS DESCRICAO,
  DBMS_LOB.GETLENGTH(e.DESC_VISITA)       AS DESCRICAO_TAMANHO,
  e.IMP_CLIENTE
FROM POWERBI.POWERBI_IMPLANTACAO_EXTRATO_HORAS e
WHERE e.PROTOCOLO = :protocolo
  AND TO_CHAR(e.DATAHORA, 'YYYY-MM-DD HH24:MI') = :datahora
FETCH FIRST 1 ROWS ONLY`;

/** RNS ligadas a uma RNS de implantação.
 *
 * `POWERBI_IMPLANTACAO_RNS_VINCULADAS` guarda TODAS as RNS do SICLA (56.869 em 2026-07-29),
 * mas só **379** têm `IMP_COD` preenchido — é esse campo que amarra a RNS a uma implantação,
 * e é o que dá nome à view ("vinculadas"). O `WHERE IMP_COD IS NOT NULL` é, portanto, a
 * própria definição da página; sem ele a tela viraria um dump do SICLA inteiro.
 *
 * A view já traz os dados da implantação embutidos (`IMP_*`); o join com o RESUMO é só para
 * o status e o consultor, que ela não tem. */
export const SQL_RNS_VINCULADAS = `SELECT
  v.CODIGO,
  v.PEDIDO,
  v.ITEM,
  TO_CHAR(v.DATACRI, 'YYYY-MM-DD') AS DATA_CRIACAO,
  v.STATUSDES,
  v.SIGLA,
  v.SISDESCRI,
  v.VISAOGERAL,
  v.VERSOESGERACAO,
  v.VALIDADOCLI,
  v.TIPODES,
  v.RESNOME,
  v.ANANOME,
  v.CLIENTE,
  v.FANTASIA,
  v.IMP_COD,
  v.IMP_DESCRICAO,
  r.TIPOSTATUS AS STATUS_IMPLANTACAO,
  r.TECNICO,
  c.GRECONDES AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_IMPLANTACAO_RNS_VINCULADAS v
LEFT JOIN POWERBI.POWERBI_IMPLANTACAO_RESUMO r ON r.CODIGO = v.IMP_COD
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = v.CLIENTE
WHERE v.IMP_COD IS NOT NULL
  AND (:data_ini IS NULL OR v.DATACRI >= TO_DATE(:data_ini, 'YYYY-MM-DD'))
  AND (:data_fim IS NULL OR v.DATACRI <  TO_DATE(:data_fim, 'YYYY-MM-DD') + 1)
-- Recorte por CLIENTE (docs/acesso-cliente-bi.md §7). Quem manda o bind é o Painel, a partir
-- do vínculo do usuário logado — nunca o navegador. É defesa em PROFUNDIDADE: a garantia
-- continua sendo o filtro do serviço, que roda sobre o resultado; este bind existe para o
-- dado alheio não sair do Oracle. Nulo = sem recorte (todo usuário interno).
  AND (:cliente IS NULL OR v.CLIENTE = :cliente)
ORDER BY v.DATACRI DESC, v.PEDIDO DESC`;

/** Indicadores de Implantação — porte das páginas do BI `BI_Interno.pbix` que ficam na aba
 * **BI Implantação**: Indicadores de Contratação, Indicadores de Conclusão e % de Utilização
 * das Horas. As três saem da MESMA view, por isso um endpoint só as atende.
 *
 * Fonte: `POWERBI.POWERBI_IMP_RNIMPLANTACAO_2` (2.889 linhas em 2026-07-29) — a mesma que a
 * consulta salva "Previsão Início Oficial" já usava.
 *
 * ⚠️ Peculiaridades desta view, todas confirmadas no banco:
 *  - **As datas são TEXTO** `DD/MM/YYYY` (VARCHAR2(10)), não DATE. Só `DATA PREVISAO DE USO`
 *    e `DATATRANSMAN` são TIMESTAMP. Converter no Oracle exigiria `TO_DATE` sobre coluna, que
 *    quebra a query inteira num único valor sujo — a conversão é feita no serviço.
 *  - **As "HORAS ..." são strings** no formato `"108:00"`. Para cálculo valem as colunas
 *    `MINUTOS ... (DEC)`, que são numéricas.
 *  - `COMPETENCIA CONTRATACAO`/`ENCERRAMENTO` vêm como `AAAA/MM` — ordenáveis como texto, o
 *    que as torna o filtro de período mais seguro que converter data.
 *  - Nomes de coluna com ESPAÇO e ACENTO exigem aspas duplas no SQL. */
export const SQL_INDICADORES = `SELECT
  r.CODIGO,
  r.DESCRICAO,
  r.CLIENTE,
  r.FANTASIA,
  r.RESPONSAVELDES,
  r.REPRESENDES,
  r."DATA CONTRATACAO"          AS DT_CONTRATACAO,
  r."DATA ENCERRAMENTO"         AS DT_ENCERRAMENTO,
  r."DATA CRIAÇÃO"              AS DT_CRIACAO,
  r."COMPETENCIA CONTRATACAO"   AS COMP_CONTRATACAO,
  r."COMPETENCIA ENCERRAMENTO"  AS COMP_ENCERRAMENTO,
  TO_CHAR(r."DATA PREVISAO DE USO", 'YYYY-MM-DD') AS DT_PREVISAO_USO,
  TO_CHAR(r.DATATRANSMAN,          'YYYY-MM-DD') AS DT_TRANSICAO,
  r."MINUTOS CONTRATADOS (DEC)"     AS MIN_CONTRATADOS,
  r."MINUTOS REALIZADOS (DEC)"      AS MIN_REALIZADOS,
  r."SALDO DE MINUTOS (DEC)"        AS MIN_SALDO,
  r."MINUTOS COBRADOS"              AS MIN_COBRADOS,
  r."MINUTOS BONIFICADOS"           AS MIN_BONIFICADOS,
  r."MINUTOS COBRADOS ADICIONAIS"   AS MIN_COBRADOS_AD,
  r."MINUTOS BONIFICADOS ADICIONAIS" AS MIN_BONIFICADOS_AD,
  r."POSIÇÃO IMPLANTAÇÃO"  AS POSICAO,
  r."TIPO IMPLANTAÇÃO"     AS TIPO_IMPLANTACAO,
  r.AREA,
  r.TIPO_SUPORTE,
  r.STATUSIMP,
  c.GRECONDES AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_IMP_RNIMPLANTACAO_2 r
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = r.CLIENTE
WHERE (:comp_ini IS NULL OR NVL(r."COMPETENCIA CONTRATACAO", '0000/00') >= :comp_ini)
  AND (:comp_fim IS NULL OR NVL(r."COMPETENCIA CONTRATACAO", '9999/99') <= :comp_fim)
ORDER BY r."COMPETENCIA CONTRATACAO" DESC, r.CODIGO DESC`;

/** "Movimentos de trabalho efetivo" — página do `BI_Interno.pbix` na aba **BI Implantação**.
 * Fonte: `POWERBI.POWERBI_APONTAMENTO_TECNICOS` — **663.969 linhas** em 2026-07-29, é a MAIOR
 * origem entre todas as páginas de BI já portadas (a segunda maior, RNS vinculadas, tem 56,9
 * mil). É uma VIEW **sem índice próprio** (confirmado em `ALL_IND_COLUMNS`): um `COUNT(*)` sem
 * filtro levou **~4 minutos**; com filtro de `DTINICIO` (a única coluna TIMESTAMP real da
 * tabela — as demais datas são texto ou nem existem), o mesmo tipo de consulta cai para
 * segundos (3s numa janela de 30 dias, ~18s numa de 12 meses com 210 mil linhas cruas).
 *
 * ⚠️ Por isso esta página FOGE do padrão das outras: em vez de "busca tudo, filtra e agrega no
 * Node" (o que as outras ~10 páginas de BI fazem), o SQL já entrega AGRUPADO por
 * técnico/tipo de movimento/cobrança — filtro de período obrigatório e limitado a **6 meses**
 * (`MAX_MESES_JANELA`), e as ~400 linhas agrupadas resultantes é que sofrem filtro/cascata em
 * memória. Buscar as linhas cruas (210 mil só em 12 meses) para agregar no Node seria repetir
 * o mesmo problema de escala que already existe no card "Movimentos" — só que pior, porque cada
 * requisição HTTP pagaria a travessia inteira.
 *
 * `DATA_RECH`/`ANO RECH` (slicers do relatório original) são texto **sem ano completo**
 * (`"07-Julho"`, sem o ano na mesma coluna) e parecem ser data de FECHAMENTO/processamento do
 * apontamento, não da atividade — `DTINICIO` (TIMESTAMP) é a data real da atividade e a que
 * filtra rápido; o período desta página usa `DTINICIO`, não `DATA_RECH`.
 *
 * `MINDURACAO` ≈ `DURACAO_TOTAL` em praticamente toda amostra observada (a diferença é
 * `SEGDURACAO`, quase sempre 0) — a tela usa `MINDURACAO` como duração total e `MINCOBRADO`
 * como a parte cobrada (nem sempre igual: `PENDENCIA`, por exemplo, tem duração mas
 * `MINCOBRADO = 0`). `VALOR_COBRADO` é valor monetário, fora do escopo desta página (que é de
 * horas, não de faturamento). `CAT`/`TIPOCATDES` são sempre NULL nas 663.969 linhas — não
 * usadas. */
export const SQL_MOVIMENTOS_AGRUPADOS = `SELECT
  a.TECNICODES,
  a.TP_MOVIMENTO,
  a.COBRA_HORA,
  COUNT(*)             AS QTD,
  SUM(a.MINDURACAO)    AS MIN_TOTAL,
  SUM(a.MINCOBRADO)    AS MIN_COBRADO
FROM POWERBI.POWERBI_APONTAMENTO_TECNICOS a
WHERE a.DTINICIO >= TO_DATE(:data_ini, 'YYYY-MM-DD')
  AND a.DTINICIO <  TO_DATE(:data_fim, 'YYYY-MM-DD')
GROUP BY a.TECNICODES, a.TP_MOVIMENTO, a.COBRA_HORA`;

// Espelha webapp/db.py:_SQL_PREVISAO_INICIO_OFICIAL — mesmo texto, mesmos comentários de
// aviso para o Administrador conferir o nome real das colunas na view.
export const SQL_PREVISAO_INICIO_OFICIAL = `-- Clientes com Previsao de Inicio Oficial dentro do periodo informado (view POWERBI do SICLA).
-- AJUSTE SE PRECISO: "DATA PREVISAO INICIO OFICIAL" foi o nome adotado seguindo o padrao da
-- view (DATA CRIACAO, DATA CONTRATACAO, DATA ENCERRAMENTO...) -- confirme o nome real da
-- coluna no banco (o Administrador tem acesso a rede/banco para conferir) e corrija aqui.
SELECT
  CODIGO,
  DESCRICAO,
  CLIENTE,
  FANTASIA,
  RESPONSAVELDES AS RESPONSAVEL,
  "DATA CONTRATACAO" AS DATA_CONTRATACAO,
  "DATA PREVISAO INICIO OFICIAL" AS PREVISAO_INICIO_OFICIAL,
  STATUSIMP AS SITUACAO
FROM POWERBI.POWERBI_IMP_RNIMPLANTACAO_2
WHERE "DATA PREVISAO INICIO OFICIAL" BETWEEN :data_ini AND :data_fim
ORDER BY "DATA PREVISAO INICIO OFICIAL"`;
