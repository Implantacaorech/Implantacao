/** Recuperação da aba que ficou para trás quando o Painel foi reconstruído.
 *
 * O `ng build` gera nomes com hash e apaga os chunks antigos. Uma aba aberta ANTES do
 * rebuild segue com o `main-*.js` velho: ao navegar para uma rota preguiçosa
 * (`loadComponent: () => import(...)`), ela pede um `chunk-*.js` que não existe mais, o
 * `import()` rejeita e a navegação do router rejeita junto. Nada disso é erro do usuário —
 * a única saída é recarregar a página para buscar o `index.html` novo.
 *
 * Foi assim que um rebuild em produção virou "os logins não estão funcionando"
 * (2026-08-03): a senha era aceita e o token emitido, mas a ida para /home falhava. */

/** Marca a recarga já tentada NESTA aba — se o reload não resolver (build realmente
 * quebrado), não entra em laço de recarregar para sempre. */
const CHAVE_RECARGA = 'painel:recarga-por-build-novo';

/** O erro veio de um chunk que não pôde ser carregado? Cobre as mensagens dos navegadores:
 * Chrome ("Failed to fetch dynamically imported module"), Firefox ("error loading
 * dynamically imported module") e o caso em que o servidor devolveu HTML no lugar do JS
 * ("Expected a JavaScript module script but the server responded with a MIME type of
 * text/html"). */
export function ehFalhaDeChunk(erro: unknown): boolean {
  const msg =
    erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro ?? '');
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Failed to load module script/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg)
  );
}

/** Recarrega a página uma única vez quando o erro for de chunk. Devolve `true` quando a
 * recarga foi disparada — quem chamou não deve mostrar mensagem de erro nenhuma, porque a
 * página está saindo. */
export function recarregarSeBuildTrocou(erro: unknown): boolean {
  if (!ehFalhaDeChunk(erro)) return false;
  if (sessionStorage.getItem(CHAVE_RECARGA)) return false; // já tentamos nesta aba
  sessionStorage.setItem(CHAVE_RECARGA, '1');
  location.reload();
  return true;
}

/** Chamado depois de uma navegação bem-sucedida: a aba está com o build atual, então a
 * próxima falha de chunk (um rebuild futuro) volta a poder recarregar. */
export function limparMarcaDeRecarga(): void {
  sessionStorage.removeItem(CHAVE_RECARGA);
}
