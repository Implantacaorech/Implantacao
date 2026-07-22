/** Converte para texto um valor de origem externa e sem tipo — linha do Oracle, célula de
 * planilha, registro genérico.
 *
 * Existe porque `String(valor)` sobre um objeto devolve a string literal "[object Object]" e
 * a grava como se fosse dado. Nas telas de disponibilidade e na importação da matriz isso
 * apareceria como nome de técnico ou competência, sem erro nenhum — falha silenciosa e
 * difícil de rastrear. Aqui, o que não é escalar vira string vazia, que os chamadores já
 * tratam como "sem valor". */
export function textoDe(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'bigint')
    return String(valor);
  if (typeof valor === 'boolean') return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  return '';
}

/** `textoDe` já com `trim()` — a forma mais usada nos chamadores. */
export function textoAparado(valor: unknown): string {
  return textoDe(valor).trim();
}
