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
ORDER BY r.DATACONTRATACAO DESC NULLS LAST, r.CODIGO DESC`;

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

/** Quantos caracteres da descrição vêm na LISTAGEM. `DESC_VISITA` é um CLOB que chega a
 * ~71 mil caracteres; num recorte de 12 meses são ~6,5 mil lançamentos, então cada 1.000
 * caracteres por linha viram ~6 MB de resposta. O relatório original mostrava 60 caracteres
 * na lista e o resto num modal — aqui a lista recebe 300 (dá para uma prévia de 2 linhas) e
 * o texto completo vem sob demanda em `SQL_EXTRATO_DESCRICAO`, ao abrir o item.
 *
 * O teto do `DBMS_LOB.SUBSTR` é em BYTES (VARCHAR2): com acentos em UTF-8, pedir 4.000
 * caracteres estoura com ORA-06502. Por isso o texto completo vem em blocos de 8.000 bytes. */
export const TRECHO_DESCRICAO = 300;

/** Teto de linhas do extrato — mais volumoso que o resumo (10.111 lançamentos no total).
 * Em 12 meses são ~6,5 mil lançamentos, então o teto ainda dá folga. */
export const LIMITE_LINHAS_EXTRATO = 10000;

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
ORDER BY e.DATAHORA DESC`;

/** Texto completo de UM lançamento — buscado só quando o usuário abre a descrição.
 * A chave é composta (protocolo + data/hora) porque o protocolo sozinho pode repetir. */
export const SQL_EXTRATO_DESCRICAO = `SELECT
  DBMS_LOB.SUBSTR(e.DESC_VISITA, 8000, 1) AS DESCRICAO,
  DBMS_LOB.GETLENGTH(e.DESC_VISITA)       AS DESCRICAO_TAMANHO
FROM POWERBI.POWERBI_IMPLANTACAO_EXTRATO_HORAS e
WHERE e.PROTOCOLO = :protocolo
  AND TO_CHAR(e.DATAHORA, 'YYYY-MM-DD HH24:MI') = :datahora
FETCH FIRST 1 ROWS ONLY`;

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
ORDER BY v.DATACRI DESC, v.PEDIDO DESC`;

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
ORDER BY a.DATAINI, a.HORAINI`;

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

/** Ordem de precedência do status de um técnico no dia (a do DAX). */
export const PRECEDENCIA_STATUS = [
  '9-Cancelada',
  '7-Não realizada',
  '8-Postergada',
  '6-Realizada',
  '3-Agendada',
  '1-Solicitada',
];

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
 * o serviço semeia o SQL padrão abaixo sob este slug no boot e passa a usar a versão
 * gravada lá — o Administrador edita a consulta pelo painel, sem deploy (mesmo desenho da
 * `rns_lista_itemped` da tela Execução → RNS). */
export const SLUG_CONSULTA_VISITAS_PORTAL = 'bi_visitas_portal';
export const NOME_CONSULTA_VISITAS_PORTAL =
  'BI — Visitas do Portal Rech (aprovação)';

/** Painel do Resumo de Implantação: visitas com status de aprovação (empresa, contato,
 * consultor, protocolo, data/horário e turno).
 *
 * A consulta ORIGINAL do usuário (2026-08-17) lia as tabelas do banco do PORTAL RECH
 * (`visita`/`visita_aprovacao`/`empresa`/`contato`/`usuario`) — essas tabelas NÃO existem
 * no Oracle da conexão (ORA-00942; conferido no catálogo `ALL_OBJECTS` em 2026-08-17: o
 * banco do Portal é outro, fora do alcance desta conexão). O default abaixo lê o
 * equivalente do SICLA, `SICLA.LISTA_VISITAS` (as visitas registradas/enviadas ao SICLA),
 * preservando os aliases, o CASE de turno e o ORDER BY do original:
 *
 *   EMPRESA ← CLIFANTASIA · CODIGO_CLIENTE ← CLIENTE (código do cliente no SICLA — amarra
 *   o painel ao cliente filtrado) · CONTATO ← CONTATO · CONSULTOR ← TECNOME ·
 *   PROTOCOLO ← PROTOCOLOVIS (o nº do PROTOCOLO DA VISITA — cresce junto com a data; a
 *   coluna PROTOCOLO da view é o atendimento que ORIGINOU a visita e mostrava números que
 *   "não existem" para quem consulta visitas, correção de 2026-08-17) ·
 *   DATA/HORARIO/TURNO ← INICIO · APROVADO ← RECEBIDA (1 = Sim).
 *
 * O recorte de período (`:data_ini`/`:data_fim`, fim INCLUSIVE) segue o De/Até da tela —
 * mesma decisão de `SQL_RESUMO_IMPLANTACAO`. A versão vigente é a do Consultas BD
 * (`SLUG_CONSULTA_VISITAS_PORTAL`): o Administrador edita sem deploy — é lá que se troca
 * PROTOCOLO por PROTOCOLOVIS/CODVISITA, se preferirem o nº do registro de visita.
 *
 * ⚠️ O ORDER BY aqui NÃO é a ordem de exibição — é a política de corte do teto de linhas.
 * O `maxRows` do driver corta na ordem do ORDER BY; com a ordem alfabética original, um
 * período com mais linhas que o teto descartava CLIENTES INTEIROS do fim do alfabeto antes
 * do filtro de cliente da tela rodar (visto em produção em 2026-08-17: ~7,9 mil visitas em
 * 12 meses × teto de 5 mil). `INICIO DESC` faz o excedente cortar as visitas mais ANTIGAS.
 * A ordem de exibição (empresa → contato → consultor → data, a da consulta original do
 * usuário) é aplicada pela tela, em memória. */
export const SQL_VISITAS_PORTAL_PADRAO = `-- Consulta do painel "Visitas do Portal Rech" (BI Implantação Clientes SIGER → Resumo,
-- abaixo do CONTROLE DE HORAS). Semeada pelo Painel; editável aqui.
-- As tabelas do banco do PORTAL (visita, visita_aprovacao, empresa, contato, usuario) NÃO
-- existem no Oracle do SICLA (ORA-00942, verificado no catálogo em 2026-08-17) — esta
-- versão lê o equivalente do SICLA, SICLA.LISTA_VISITAS (as visitas registradas/enviadas
-- ao SICLA). De/para dos campos:
--   EMPRESA    <- CLIFANTASIA          CONTATO   <- CONTATO
--   CONSULTOR  <- TECNOME              PROTOCOLO <- PROTOCOLOVIS (nº do PROTOCOLO DA
--                                        VISITA; a coluna PROTOCOLO da view é o
--                                        atendimento que originou a visita, e CODVISITA é
--                                        o código interno do registro)
--   APROVADO   <- RECEBIDA (1 = Sim)   DATA/HORARIO/TURNO <- INICIO
-- :data_ini/:data_fim são supridos automaticamente pelo De/Até da tela (fim inclusive);
-- removê-los desliga o recorte de período. Mantenha os ALIASES das colunas: são o contrato
-- com a tela — CODIGO_CLIENTE em especial é o que amarra a visita ao cliente filtrado nos
-- demais filtros do Resumo (é o código do cliente no SICLA).
-- O ORDER BY é a POLÍTICA DE CORTE do teto de linhas, não a ordem de exibição: quando o
-- período tem mais linhas que o teto, o driver corta na ordem do ORDER BY — INICIO DESC
-- garante que o excedente descarte as visitas mais ANTIGAS (na ordem alfabética original,
-- clientes inteiros do fim do alfabeto sumiam). A tela exibe ordenado por empresa →
-- contato → consultor → data, em memória.
SELECT
    v.CLIFANTASIA AS EMPRESA,
    v.CLIENTE AS CODIGO_CLIENTE,
    v.CONTATO AS CONTATO,
    v.TECNOME AS CONSULTOR,
    v.PROTOCOLOVIS AS PROTOCOLO,

    TO_CHAR(v.INICIO, 'YYYY-MM-DD') AS DATA,

    TO_CHAR(v.INICIO, 'HH24:MI:SS') AS HORARIO,

    CASE
        WHEN TO_CHAR(v.INICIO, 'HH24:MI:SS') BETWEEN '07:00:00' AND '12:59:59'
            THEN 'MANHÃ'

        WHEN TO_CHAR(v.INICIO, 'HH24:MI:SS') BETWEEN '13:00:00' AND '19:00:00'
            THEN 'TARDE'

        WHEN TO_CHAR(v.INICIO, 'HH24:MI:SS') BETWEEN '19:01:00' AND '23:59:59'
            THEN 'NOITE'

        ELSE 'FORA DO TURNO'
    END AS TURNO,

    CASE
        WHEN v.RECEBIDA = 1 THEN 'Sim'
        ELSE 'Não'
    END AS APROVADO

FROM SICLA.LISTA_VISITAS v

WHERE (:data_ini IS NULL OR v.INICIO >= TO_DATE(:data_ini, 'YYYY-MM-DD'))
  AND (:data_fim IS NULL OR v.INICIO <  TO_DATE(:data_fim, 'YYYY-MM-DD') + 1)

ORDER BY
    v.INICIO DESC`;

/** Teto de linhas do painel de visitas — MAIOR que o `LIMITE_LINHAS` geral de propósito:
 * o filtro de cliente roda NA TELA, depois do corte do Oracle, então o corte precisa ser
 * raro para o filtro enxergar o período inteiro. Em 2026-08-17 a view tinha ~7,9 mil
 * visitas em 12 meses (o teto de 5 mil truncava a janela padrão); 20 mil dá ~2,5 anos de
 * folga no volume atual, com payload na casa do extrato (que já traz 10 mil linhas mais
 * pesadas). */
export const LIMITE_VISITAS_PORTAL = 20000;

/** Uma visita do Portal já normalizada — os campos seguem os ALIASES do SELECT. */
export interface LinhaVisitaPortal {
  empresa: string;
  /** `CODIGO_CLIENTE` do Portal = código do cliente no SICLA — chave com que a tela casa a
   * visita com o cliente filtrado nos demais filtros do Resumo. */
  cliente: number | null;
  contato: string;
  consultor: string;
  protocolo: number | null;
  /** AAAA-MM-DD (ou '' quando a coluna vier vazia). */
  data: string;
  /** HH:MM:SS, como a consulta devolve. */
  horario: string;
  /** MANHÃ | TARDE | NOITE | FORA DO TURNO (calculado no SQL). */
  turno: string;
  /** 'Sim'/'Não' como o SQL devolve — texto, não boolean, para a edição da consulta no
   * Consultas BD poder mudar o rótulo sem quebrar a tela. */
  aprovado: string;
}
