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

/** Teto de linhas — a view tem ~2,9 mil no total, então 5.000 cobre com folga. */
export const LIMITE_INDICADORES = 5000;

/** Uma RNS de implantação, já normalizada (datas em ISO, horas em decimal). */
export interface LinhaIndicador {
  codigo: number;
  descricao: string;
  cliente: number | null;
  fantasia: string;
  responsavel: string;
  representante: string;
  /** AAAA-MM-DD (convertido do `DD/MM/YYYY` que a view devolve). */
  dataContratacao: string;
  dataEncerramento: string;
  dataCriacao: string;
  dataPrevisaoUso: string;
  dataTransicao: string;
  /** AAAA-MM. */
  competenciaContratacao: string;
  competenciaEncerramento: string;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  /** Normais + adicionais, como o BI soma. */
  horasCobradas: number;
  horasBonificadas: number;
  /** % de consumo das horas contratadas (null quando não há contratação). */
  percentualUtilizacao: number | null;
  posicao: string;
  tipoImplantacao: string;
  area: string;
  tipoSuporte: string;
  statusImp: number;
  grupoEconomico: string;
  /** Meses entre contratação e encerramento — null enquanto não encerrou. */
  leadTimeMeses: number | null;
  concluida: boolean;
}

export interface TotaisIndicadores {
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasSaldo: number;
  horasCobradas: number;
  horasBonificadas: number;
  percentualUtilizacao: number | null;
  concluidos: number;
  /** Média de lead-time (meses) entre os que têm encerramento. */
  leadTimeMedio: number | null;
}

/** Agregado por competência (mês) — alimenta os gráficos das três páginas. */
export interface SerieMensal {
  competencia: string;
  projetos: number;
  clientes: number;
  horasContratadas: number;
  horasRealizadas: number;
  horasCobradas: number;
  horasBonificadas: number;
  /** % realizadas/contratadas do mês. */
  percentualUtilizacao: number | null;
}

export interface ContagemIndicador {
  chave: string;
  quantidade: number;
  horasContratadas: number;
  horasRealizadas: number;
}
