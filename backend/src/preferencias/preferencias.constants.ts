/** Chave de preferência aceita: minúsculas, dígitos, `.`, `-` e `_`. Fechado de propósito —
 * a chave vem da URL e vira parte de um índice único; nada além disto precisa passar. */
export const CHAVE_PREFERENCIA_RE = /^[a-z0-9][a-z0-9._-]{0,59}$/;

/** Teto do JSON de uma preferência. Filtro de tela é um punhado de strings e listas curtas;
 * 20 KB já é folgado. O limite existe para que um bug de tela (acumular seleção sem parar,
 * por exemplo) não vire linha gigante no banco. */
export const TAMANHO_MAX_PREFERENCIA = 20_000;
