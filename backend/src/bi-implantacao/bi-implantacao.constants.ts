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

/** Espécies de compromisso que o calendário mostra.
 *
 * O relatório exibia SÓ estas três — é o que a medida `Calendario` rotula (`SWITCH` sobre 84,
 * 92 e 90) e o que o slicer de `ESPECIE` da página deixava passar. O resto da agenda do SICLA
 * (férias, reuniões táticas/estratégicas, posto flex, atendimentos COBRADOS) não é da
 * implantação e polui a grade: em julho/2026, das 706 agendas do mês, **607 são destas três**
 * e 99 ficam de fora.
 *
 * ⚠️ Os códigos vêm do DAX, mas os rótulos dele estavam errados (dizia 92 = "Agenda
 * Presencial"; a view diz "Atendimento Externo NÃO COBRADO"). A tela mostra o `ESPECIEDES`. */
export const ESPECIES_CALENDARIO = [84, 90, 92];

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
