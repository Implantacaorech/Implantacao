/** Extração dos binds de um SQL — a base da criação de consulta PELA TELA.
 *
 * Quem cadastra uma consulta não digita a lista de parâmetros: cola o SELECT e o sistema
 * descobre os `:binds` que o texto cita. Isso elimina de saída os dois erros mais comuns —
 * declarar parâmetro que o SQL não usa (bind sobrando é ORA-01036) e esquecer um que ele
 * usa (bind faltando é ORA-01008). Ao operador resta escolher o TIPO de cada um.
 */

/** `:nome` seguido de algo que não seja letra, dígito ou `_`. O `(?<![:\w])` à esquerda
 * descarta `::` (cast do Postgres, que pode aparecer num texto colado) e evita casar o
 * miolo de um identificador. */
const RE_BIND = /(?<![:\w]):([a-z_][a-z0-9_]*)/gi;

/** Trechos que NÃO são SQL executável e onde um `:algo` não é bind: comentário de linha,
 * comentário de bloco e literal entre aspas simples. Um `-- veja :data_ini` num comentário
 * viraria parâmetro fantasma; um `'as 10:30'` viraria o bind `:30`… se o nome permitisse. */
function semRuido(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Nomes dos binds citados pelo SQL, sem repetir, na ordem em que aparecem. */
export function extrairBinds(sql: string): string[] {
  const limpo = semRuido(sql || '');
  const achados: string[] = [];
  for (const m of limpo.matchAll(RE_BIND)) {
    if (!achados.includes(m[1])) achados.push(m[1]);
  }
  return achados;
}

/** O SQL é uma leitura? Mesma regra dos executores (só `SELECT`/`WITH`), aplicada ANTES de
 * salvar: uma consulta de escrita não deve nem chegar a existir no catálogo. */
export function ehLeitura(sql: string): boolean {
  const inicio = semRuido(sql || '')
    .replace(/^[\s(]+/, '')
    .toUpperCase();
  return inicio.startsWith('SELECT') || inicio.startsWith('WITH');
}
