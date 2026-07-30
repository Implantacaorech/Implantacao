/** Apoio às listas de filtro do BI de Implantação.
 *
 * Alguns filtros têm MUITAS opções (215 grupos econômicos, 819 RNS, 405 clientes no recorte
 * padrão). Renderizar tudo de uma vez deixa o painel inutilizável, então cada bloco ganha um
 * campo de busca e um teto de itens exibidos. */

/** Quantas opções aparecem por bloco antes de exigir que o usuário refine a busca. */
export const TETO_OPCOES = 80;

/** Sem acento e sem caixa: procurar "cocolandia" acha "COCOLÂNDIA". */
function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Filtra por termo (sem acento/caixa) e corta no teto, MAS sempre mantém o que já está
 * marcado — senão um item selecionado some da lista e o usuário não consegue desmarcá-lo. */
export function opcoesVisiveis<T>(
  itens: T[],
  termo: string,
  texto: (i: T) => string,
  estaMarcado: (i: T) => boolean,
): { visiveis: T[]; ocultas: number } {
  const t = normalizar((termo ?? '').trim());
  const casam = t ? itens.filter((i) => normalizar(texto(i)).includes(t)) : itens;
  const marcados = itens.filter((i) => estaMarcado(i) && !casam.includes(i));
  const juntos = [...marcados, ...casam];
  return {
    visiveis: juntos.slice(0, TETO_OPCOES),
    ocultas: Math.max(0, juntos.length - TETO_OPCOES),
  };
}
