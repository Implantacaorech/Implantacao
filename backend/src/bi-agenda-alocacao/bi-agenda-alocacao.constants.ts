/** "Alocação de Agendas" — duas páginas do `BI_Interno.pbix` que ficam na aba
 * **BI Implantação**: o Calendário de compromissos dos técnicos e as Horas Aplicadas por RNS
 * de implantação. Ao contrário dos Indicadores (que saem todos de
 * `POWERBI_IMP_RNIMPLANTACAO_2`), estas duas páginas vêm de origens PRÓPRIAS — cada uma tem
 * sua constante de SQL e seu formato de linha.
 *
 * Confirmado por inspeção do relatório (`Report/definition/pages/.../page.json` e
 * `visuals/*.json` do `BI_Interno.pbix`, extraído em 2026-07-29): NENHUMA das duas páginas
 * tem filtro fixo de página ou de relatório restringindo ESPÉCIE ou TIPO_SUPORTE — os dois
 * são slicers de usuário (livres, sem seleção padrão). A única restrição de relatório
 * encontrada (`Report/definition/report.json`, `filterConfig` global) é
 * `LISTA_CLIENTES.TIPO IN ('C')` / `Clientes.TIPO IN ('C')` — cliente de verdade, não
 * prospect — que aqui é feita via o JOIN com `PEDIDOIMP`/`RNS`: uma linha só carrega
 * FANTASIA/GRUPO_ECONOMICO quando está de fato ligada a uma RNS de implantação. */

// ── Página "Alocação de Agendas - Calendário" ─────────────────────────────────────────

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
 * `PEDIDOIMP`). */
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
  r.FANTASIA,
  r.DESCRICAO AS RNS_DESCRICAO,
  c.GRECONDES AS GRUPO_ECONOMICO
FROM POWERBI.POWERBI_IMP_LISTACOMPROMISSOS_2 l
LEFT JOIN POWERBI.POWERBI_IMP_RNIMPLANTACAO_2 r ON r.CODIGO = l.PEDIDOIMP
LEFT JOIN SICLA.LISTA_CLIENTES c ON c.CODIGO = r.CLIENTE
WHERE l.DATADIA >= TO_DATE(:mes_ini, 'YYYY-MM-DD')
  AND l.DATADIA <  TO_DATE(:mes_fim, 'YYYY-MM-DD')
ORDER BY l.DATAINI`;

/** Teto de linhas do calendário — folga generosa sobre o volume observado (~1,2 mil/mês). */
export const LIMITE_CALENDARIO = 5000;

/** Rótulo do `STATUS` numérico da agenda — mesmas 4 primeiras chaves de
 * `COR_STATUS_AGENDA` (bi-implantacao), de propósito: é o mesmo vocabulário de status de
 * compromisso, só que esta view nunca guarda 8-Postergada/9-Cancelada (confirmado: só
 * aparecem os códigos 1, 3, 6 e 7 em 5.452 linhas). */
export const STATUS_ALOCACAO: Record<number, string> = {
  1: '1-Solicitada',
  3: '3-Agendada',
  6: '6-Realizada',
  7: '7-Não realizada',
};

export const COR_STATUS_ALOCACAO: Record<string, string> = {
  '1-Solicitada': '#FFFFE0',
  '3-Agendada': '#E0FFE0',
  '6-Realizada': '#FFF5E0',
  '7-Não realizada': '#F5DEB3',
};

/** Um compromisso (uma linha = um técnico daquele compromisso). */
export interface LinhaAlocacao {
  codigo: number;
  dia: string;
  horaIni: string;
  horaFim: string;
  status: string;
  assunto: string;
  minutos: number;
  rns: number | null;
  especie: number;
  especieDes: string;
  tecnico: string;
  tipoSuporte: string;
  fantasia: string;
  rnsDescricao: string;
  grupoEconomico: string;
}

export interface DiaAlocacao {
  dia: string;
  /** Dia do mês (1..31). */
  numero: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  compromissos: LinhaAlocacao[];
}

export interface ResumoStatusAlocacao {
  status: string;
  quantidade: number;
  percentual: number;
  cor: string;
}

// ── Página "Alocação de Agendas - Horas Aplicadas" ────────────────────────────────────

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

/** Teto de linhas — a view tem 6,3 mil no total; a folga cobre até uma janela bem larga. */
export const LIMITE_HORAS_APLICADAS = 8000;

/** Um compromisso já normalizado (uso interno do serviço — não sai da tela por linha, só
 * agregado por RNS). */
export interface CompromissoHoras {
  rns: number | null;
  horas: number;
  statusFlag:
    | 'encaminhada'
    | 'agendada'
    | 'realizada'
    | 'naoRealizada'
    | 'postergada'
    | 'cancelada';
  fantasia: string;
  rnsDescricao: string;
  responsavel: string;
  tipoSuporte: string;
  grupoEconomico: string;
}

/** Uma RNS agregada — o que a tabela "PROJETOS DE IMPLANTAÇÃO" do BI mostra. */
export interface LinhaHorasAplicadas {
  rns: number;
  fantasia: string;
  rnsDescricao: string;
  responsavel: string;
  tipoSuporte: string;
  grupoEconomico: string;
  qtdCompromissos: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  /** % de horas Postergadas sobre o total — a medida "% Horas Postergadas" do BI. */
  percentualPostergada: number | null;
}

export interface TotaisHorasAplicadas {
  rnsQuantidade: number;
  horasEncaminhada: number;
  horasAgendada: number;
  horasRealizada: number;
  horasNaoRealizada: number;
  horasPostergada: number;
  horasCancelada: number;
  horasTotal: number;
  percentualPostergada: number | null;
}
