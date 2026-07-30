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

/** Janela padrão — mais curta que o resto do BI (12 meses) de propósito: 12 meses aqui já
 * levou ~18s numa consulta agregada; 3 meses é o equilíbrio entre "período útil" e resposta
 * rápida. */
export const MESES_PADRAO_MOVIMENTOS = 3;

/** Teto duro da janela — mesmo pedindo mais, o serviço recorta para isto. É guarda real contra
 * uma consulta de minutos (não é validação especulativa: o comportamento sem filtro já foi
 * medido). */
export const MAX_MESES_JANELA_MOVIMENTOS = 6;

/** ⚠️ Os 6 valores de `TP_MOVIMENTO` (RNS/PENDENCIA/AGENDA/ATENDIMENTOS/VISITAS/FICHA) não são
 * necessariamente blocos de tempo mutuamente exclusivos — o relatório original mostra as 6
 * "_Total_horas_X_decimais" como barras SEPARADAS num `clusteredBarChart`, nunca somadas numa
 * medida "grand total" confirmada. Testado em produção (2026-07-29, janela de 3 meses): a
 * média por técnico fica em ~8,5h/dia (plausível), mas alguns técnicos individualmente somam
 * mais de 13h/dia quando os 6 tipos são somados — sinal de que AGENDA/VISITAS (sempre 100%
 * cobradas) e RNS/PENDENCIA/ATENDIMENTOS/FICHA (sempre 0% cobradas) podem registrar o MESMO
 * intervalo de relógio por ângulos diferentes do SICLA, não tempo adicional. `horasTotal`
 * (aqui e no `TotaisMovimentos`) é a SOMA dos 6 tipos — útil para comparar proporções entre
 * categorias, mas não deve ser lido como "quantas horas o técnico trabalhou" sem essa
 * ressalva. Não há DAX acessível (binário) para confirmar a fórmula original. */

/** Uma combinação técnico × tipo de movimento × cobrança, já agregada pelo Oracle. */
export interface LinhaMovimentoAgrupado {
  tecnico: string;
  tpMovimento: string;
  cobraHora: boolean;
  quantidade: number;
  minutosTotal: number;
  minutosCobrado: number;
}

/** Totais por uma dimensão (técnico OU tipo de movimento) — o que as duas tabelas/gráficos da
 * página mostram. */
export interface ContagemMovimento {
  chave: string;
  quantidade: number;
  horasTotal: number;
  horasCobradas: number;
  horasNaoCobradas: number;
  /** % cobradas sobre o total — null sem horas. */
  percentualCobradas: number | null;
}

export interface TotaisMovimentos {
  quantidade: number;
  tecnicos: number;
  horasTotal: number;
  horasCobradas: number;
  horasNaoCobradas: number;
  percentualCobradas: number | null;
}
