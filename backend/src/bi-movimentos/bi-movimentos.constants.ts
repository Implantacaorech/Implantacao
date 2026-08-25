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
