import { ChaveConexao } from '../catalogo.types';

/** SELECT mínimo que prova que a conexão abre e responde, por dialeto.
 *
 * Não toca em tabela nenhuma **de propósito**: o que este SELECT testa é a CREDENCIAL, não
 * o privilégio de leitura. Separar as duas coisas é o que faz a mensagem de erro dizer a
 * verdade — "usuário ou senha recusados" é um problema; "sem permissão na view X" é outro
 * bem diferente, e misturá-los mandaria o Administrador procurar no lugar errado.
 *
 * Mora aqui, e não junto do roteador de conexões, porque em `src/dados/` **todo SQL vive no
 * catálogo** — a guarda `conformidade-api-dados.spec.ts` recusa texto de SQL em qualquer
 * outra pasta do módulo. */
export const SELECT_DE_VIDA: Record<ChaveConexao, string> = {
  sicla: 'SELECT 1 AS VIVO FROM DUAL',
  portal_rech: 'SELECT 1 AS VIVO',
};
