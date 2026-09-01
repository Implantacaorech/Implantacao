/** Ordenação por PONTO MÉDIO — o que permite mover um cartão gravando UMA linha.
 *
 * A alternativa ingênua (ordem = índice inteiro) obriga a reescrever todas as linhas abaixo
 * da posição de destino a cada arraste. Aqui a nova ordem é a média entre os vizinhos, então
 * o UPDATE é sempre de uma linha só.
 *
 * O preço é a precisão: cada inserção no mesmo ponto divide o intervalo pela metade, e o
 * `double` (~15 dígitos significativos) aguenta ~50 divisões antes de os vizinhos colarem.
 * `precisaRenumerar` detecta essa aproximação MUITO antes do limite, e aí a coluna inteira é
 * renumerada de uma vez — operação rara, e a única em que se paga o custo de reescrever
 * tudo. */

/** Espaçamento entre itens numa renumeração. */
export const PASSO_ORDEM = 1024;

/** Abaixo deste intervalo entre vizinhos, renumere a coluna antes que o `double` colapse. */
export const INTERVALO_MINIMO = 0.0001;

/** Ordem de um item inserido entre `anterior` e `proximo` (qualquer um pode faltar).
 *
 * - sem vizinho nenhum → `PASSO_ORDEM`
 * - só anterior (fim da lista) → anterior + PASSO_ORDEM
 * - só próximo (início da lista) → próximo − PASSO_ORDEM
 * - entre os dois → a média */
export function ordemEntre(
  anterior?: number | null,
  proximo?: number | null,
): number {
  const a =
    typeof anterior === 'number' && Number.isFinite(anterior) ? anterior : null;
  const p =
    typeof proximo === 'number' && Number.isFinite(proximo) ? proximo : null;
  if (a === null && p === null) return PASSO_ORDEM;
  if (a === null) return (p as number) - PASSO_ORDEM;
  if (p === null) return a + PASSO_ORDEM;
  return (a + p) / 2;
}

/** Os vizinhos ficaram próximos demais para uma próxima divisão ser confiável? */
export function precisaRenumerar(
  anterior?: number | null,
  proximo?: number | null,
): boolean {
  if (typeof anterior !== 'number' || typeof proximo !== 'number') return false;
  return Math.abs(proximo - anterior) < INTERVALO_MINIMO;
}

/** Ordens renumeradas com espaçamento regular, para uma lista já na sequência desejada. */
export function renumerar(quantidade: number): number[] {
  return Array.from(
    { length: Math.max(0, quantidade) },
    (_, i) => (i + 1) * PASSO_ORDEM,
  );
}

/** Reordena `itens` (já ordenados por `ordem`) colocando `id` na posição `indice`, e devolve
 * a sequência final de ids. Usado pelo caminho "mover para o índice N", que é o que o
 * arraste e as setas do teclado mandam. */
export function sequenciaCom<T extends { id: number }>(
  itens: T[],
  id: number,
  indice: number,
): number[] {
  const sem = itens.filter((i) => i.id !== id).map((i) => i.id);
  const pos = Math.max(0, Math.min(indice, sem.length));
  sem.splice(pos, 0, id);
  return sem;
}
