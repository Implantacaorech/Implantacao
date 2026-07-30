/** Chaves da sessão no `localStorage`.
 *
 * Ficam aqui, e não dentro do `AuthService`, porque o `PreferenciasService` precisa saber se
 * existe sessão antes de chamar um endpoint autenticado — e ele não pode importar o
 * `AuthService`, que importa ele (ciclo). */
export const CHAVE_ACCESS = 'painel.accessToken';
export const CHAVE_REFRESH = 'painel.refreshToken';
export const CHAVE_USUARIO = 'painel.usuario';
