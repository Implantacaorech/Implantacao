/** Chaves da sessão no `localStorage`.
 *
 * Ficam aqui, e não dentro do `AuthService`, porque o `PreferenciasService` precisa saber se
 * existe sessão antes de chamar um endpoint autenticado — e ele não pode importar o
 * `AuthService`, que importa ele (ciclo). */
export const CHAVE_ACCESS = 'painel.accessToken';
export const CHAVE_REFRESH = 'painel.refreshToken';
export const CHAVE_USUARIO = 'painel.usuario';

/** "Lembrar-me" da tela de login: guarda só o E-MAIL para repreencher o campo na próxima
 * visita. Não guarda senha nem estende a sessão — a sessão já vive no `localStorage` pelas
 * chaves acima, e a validade quem define é o refresh token (7 dias). Fica de fora do
 * `limparSessao()` de propósito: sair do Painel não deve apagar a lembrança do e-mail. */
export const CHAVE_LOGIN_LEMBRADO = 'painel.loginLembrado';
