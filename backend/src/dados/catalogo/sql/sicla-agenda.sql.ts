/** SQL das AGENDAS do SICLA — calendário de alocação (tela Agenda e BI de Alocação),
 * horas aplicadas e as agendas do BI de Implantação.
 *
 * Os três são `fixo`: o texto versionado aqui é o que roda. Mudança passa por PR. */

/** Espécies de compromisso que o calendário mostra: **84 e 92**.
 *
 * Não é inferência — é o filtro gravado no próprio visual do calendário dentro do
 * `BI_clientes.pbix` (`Report/Layout`, filtro `Categorical` do visual htmlContent da página
 * Agendas):
 *
 *     ESPECIE In ('92', '84')
 *
 * ⚠️ NÃO usar o `SWITCH` da medida `Calendario` como fonte: ele rotula **três** códigos
 * (84, 92 e 90), mas 90 é só rotulagem remanescente — o filtro do visual nunca deixou o 90
 * passar. Guiar-se pelo SWITCH traz "Produção Interna Normal Apontada", que não é agenda de
 * implantação (194 das 706 agendas de julho/2026).
 *
 * O que fica de fora, portanto: produção interna (90), férias, reuniões tática/estratégica,
 * posto flex e os atendimentos COBRADOS. Em julho/2026 sobram 413 das 706 agendas do mês.
 *
 * Os rótulos do DAX também divergem da view (ele dizia 92 = "Agenda Presencial"; o
 * `ESPECIEDES` diz "Atendimento Externo NÃO COBRADO") — a tela mostra o `ESPECIEDES`. */
export const ESPECIES_CALENDARIO = [84, 92];

/** Compromissos de técnicos (Manutenção OU Implantação — `TIPO_SUPORTE` é filtro, não
 * restrição fixa). Fonte: `POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2` — 5.452 linhas em
 * 2026-07-29, janela rolante (jul–nov/2026 no momento da inspeção).
 *
 * ⚠️ Uma linha é POR TÉCNICO: um compromisso com 2 participantes aparece em 2 linhas com o
 * mesmo `CODIGO`. Contagem de "compromissos" deve ser por `CODIGO` distinto; contagem "por
 * técnico" usa a linha direto.
 *
 * O JOIN com `PEDIDOIMP` (que é o código da RNS de implantação — confirmado: 925 de 929
 * `PEDIDOIMP` preenchidos batem com `POWERBI_IMP_RNIMPLANTACAO_2.CODIGO`) só preenche
 * FANTASIA/RNS/GRUPO_ECONOMICO quando a linha está de fato ligada a uma implantação; o
 * calendário mostra a linha do mesmo jeito quando não está (compromisso interno, sem
 * `PEDIDOIMP`).
 *
 * O JOIN com `SICLA.COMPROMISSOS` traz a OBSERVAÇÃO da agenda (pedido do usuário em
 * 2026-08-18) — a view do POWERBI não a expõe, e `CODIGO` casa 1:1 com a tabela
 * (confirmado: 6.165 de 6.165 linhas da janela casavam; 2.683 tinham observação). É CLOB:
 * chega como texto porque a conexão faz `fetchAsString = [CLOB]`. */
export const SQL_CALENDARIO_ALOCACAO = `SELECT
  l.CODIGO,
  TO_CHAR(l.DATADIA, 'YYYY-MM-DD') AS DIA,
  TO_CHAR(l.DATAINI, 'HH24:MI')    AS HORA_INI,
  TO_CHAR(l.DATAFIM, 'HH24:MI')    AS HORA_FIM,
  l.STATUS,
  l.ASSUNTO,
  l.MINUTOS,
  l.PEDIDOIMP,
  l.ESPECIE,
  l.ESPECIEDES,
  l.TECNICO,
  l.TIPO_SUPORTE,
  co.OBSERVACAO,
  r.FANTASIA,
  r.DESCRICAO AS RNS_DESCRICAO,
  c.GRECONDES AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2 l
LEFT JOIN SICLA.COMPROMISSOS co ON co.CODIGO = l.CODIGO
LEFT JOIN POWERBI.POWERBI_IMP_RNIMPLANTACAO_2 r ON r.CODIGO = l.PEDIDOIMP
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = r.CLIENTE
WHERE l.DATADIA >= TO_DATE(:mes_ini, 'YYYY-MM-DD')
  AND l.DATADIA <  TO_DATE(:mes_fim, 'YYYY-MM-DD')
ORDER BY l.DATAINI`;

/** Horas previstas por RNS de implantação, por status do compromisso. Fonte:
 * `POWERBI.POWERBI_AGENDA_POSTERGACAO_IMP_2` — 6.331 linhas em 2026-07-29 (histórico desde
 * 2009), uma linha POR COMPROMISSO com 6 colunas de indicador (`ENCAMINHADA`/`AGENDADA`/
 * `REALIZADA`/`NAO__REALIZADA`/`POSTERGADA`/`CANCELADA`), sempre exatamente UMA delas = 1.
 *
 * ⚠️ As medidas do BI ("Horas Previstas Agendada", "…Realizada" etc.) NÃO são contagem de
 * compromissos apesar do nome parecido — são a DURAÇÃO em horas
 * (`DATAFIM - DATAINI`) somada por status. Confirmado batendo os números: em julho/2026 a
 * duração média por compromisso é 3,02h (mín. 0,17h, máx. 9,5h, 0 negativos/zerados em
 * 6.331 linhas) — plausível para agenda de atendimento, o que uma contagem de "1" por linha
 * não seria. `RNS` bate com `POWERBI_IMP_RNIMPLANTACAO_2.CODIGO` em 6.197 das 6.331 linhas
 * (97,9%) — o resto é RNS antiga, fora da janela atual daquela view.
 *
 * O `Oracle` aqui devolve `DATAINI`/`DATAFIM` como TIMESTAMP; a duração é calculada no
 * SERVIÇO (`(fim - ini) / 3.600.000` em milissegundos), não no SQL — evita a interatividade
 * chata do tipo INTERVAL DAY TO SECOND do Oracle em bind/agregação. */
export const SQL_HORAS_APLICADAS = `SELECT
  a.RNS,
  TO_CHAR(a.DATAINI, 'YYYY-MM-DD"T"HH24:MI:SS') AS DATA_INI,
  TO_CHAR(a.DATAFIM, 'YYYY-MM-DD"T"HH24:MI:SS') AS DATA_FIM,
  a.ENCAMINHADA,
  a.AGENDADA,
  a.REALIZADA,
  a.NAO__REALIZADA AS NAO_REALIZADA,
  a.POSTERGADA,
  a.CANCELADA,
  r.FANTASIA,
  r.DESCRICAO       AS RNS_DESCRICAO,
  r.RESPONSAVELDES,
  r.TIPO_SUPORTE,
  c.GRECONDES        AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_AGENDA_POSTERGACAO_IMP_2 a
LEFT JOIN POWERBI.POWERBI_IMP_RNIMPLANTACAO_2 r ON r.CODIGO = a.RNS
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = r.CLIENTE
WHERE (:data_ini IS NULL OR a.DATAINI >= TO_DATE(:data_ini, 'YYYY-MM-DD'))
  AND (:data_fim IS NULL OR a.DATAINI <  TO_DATE(:data_fim, 'YYYY-MM-DD'))
ORDER BY a.DATAINI DESC`;

/** Agendas do mês. Porte da medida DAX `Calendario` do BI.
 *
 * `OBSERVACAO` é CLOB (o driver devolveria um objeto `Lob` que não serializa) — vem por
 * `DBMS_LOB.SUBSTR`, limitado porque o texto só aparece no detalhe do dia. */
export const SQL_AGENDAS = `SELECT
  a.CODIGO,
  a.RNSIMP,
  TO_CHAR(a.DATAINI, 'YYYY-MM-DD') AS DIA,
  a.HORAINI,
  a.HORAFIM,
  a.STATUSDES,
  a.ESPECIE,
  a.ESPECIEDES,
  a.PARTICIPANTES,
  a.RESPONSAVELDES,
  a.CLIENTE,
  a.CLIENTEFAN,
  a.ASSUNTO,
  a.HORASDURACAO,
  a.VISITA,
  DBMS_LOB.SUBSTR(a.OBSERVACAO, 600, 1) AS OBSERVACAO,
  r.TIPOSTATUS AS STATUS_IMPLANTACAO,
  r.TECNICO,
  r.DESCRICAO AS RNS_DESCRICAO,
  c.GRECONDES AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_IMPLANTACAO_AGENDAS a
LEFT JOIN POWERBI.POWERBI_IMPLANTACAO_RESUMO r ON r.CODIGO = a.RNSIMP
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = a.CLIENTE
WHERE a.DATAINI >= TO_DATE(:mes_ini, 'YYYY-MM-DD')
  AND a.DATAINI <  TO_DATE(:mes_fim, 'YYYY-MM-DD')
  AND a.ESPECIE IN (${ESPECIES_CALENDARIO.join(', ')})
-- Recorte por CLIENTE (docs/acesso-cliente-bi.md §7). Quem manda o bind é o Painel, a partir
-- do vínculo do usuário logado — nunca o navegador. É defesa em PROFUNDIDADE: a garantia
-- continua sendo o filtro do serviço, que roda sobre o resultado; este bind existe para o
-- dado alheio não sair do Oracle. Nulo = sem recorte (todo usuário interno).
  AND (:cliente IS NULL OR a.CLIENTE = :cliente)
ORDER BY a.DATAINI, a.HORAINI`;
