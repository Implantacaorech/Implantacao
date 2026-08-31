import {
  apenasMenusValidos,
  CODIGO_MENU,
  MenuCatalogo,
} from './menus-mencionados';

/**
 * Validação PÓS-GERAÇÃO da saída da IA contra o catálogo REAL de menus do SIGER (achado A15 da
 * auditoria de 2026-08-12).
 *
 * O problema: a IA devolve o menu principal do protocolo (`campos.menu`, ex.: "3.4-L") e cita
 * menus no texto (`menusAbordados`). O prompt PEDE que ela use só menus reais, mas isso é
 * instrução, não garantia — um código inventado ("Menu 3.4" por dedução) era gravado como está,
 * e quem revisa confia nele e vai procurar uma tela que não existe. Aqui a saída é CONFERIDA
 * contra o catálogo antes de virar dado de negócio.
 *
 * Regra de ouro: **catálogo vazio = sem validação**. Se o Dicionário ainda não foi ingerido (ou
 * a leitura falhou), não há como afirmar que um código "não existe" — então não se mexe em nada.
 * A validação é conservadora de propósito: só age sobre o que TEM FORMA de código de menu.
 */

const PLACEHOLDER_MENU = 'Menu não identificado - revisar manualmente';

/** Um token tem forma de código de menu do SIGER? (ex.: "1.4-I", "1.2-M/I/A", "1.1"). */
export function ehCodigoDeMenu(token: string): boolean {
  return CODIGO_MENU.test((token || '').trim());
}

/** Conjunto de códigos válidos (em caixa alta) a partir do catálogo do SIGER — só o que é
 * código de menu de verdade (o mesmo filtro que a busca usa). */
export function codigosValidosDoCatalogo(
  catalogo: MenuCatalogo[],
): Set<string> {
  return new Set(
    apenasMenusValidos(catalogo).map((m) => m.codigo.trim().toUpperCase()),
  );
}

/**
 * Valida o campo `menu` (o menu PRINCIPAL do protocolo). Se ele tem forma de código e NÃO está
 * no catálogo, é rejeitado: devolve o placeholder de "revisar manualmente" e o código rejeitado
 * (para a nota ao revisor). Nome de tela (não-código) e o próprio placeholder passam intactos.
 */
export function validarMenuPrincipal(
  menu: string,
  validos: Set<string>,
): { menu: string; rejeitado: string | null } {
  const t = (menu || '').trim();
  if (validos.size === 0 || !ehCodigoDeMenu(t))
    return { menu, rejeitado: null };
  if (validos.has(t.toUpperCase())) return { menu, rejeitado: null };
  return { menu: PLACEHOLDER_MENU, rejeitado: t };
}

// Padrão de código DENTRO de um texto livre. Diferente do CODIGO_MENU (que é ancorado ^$):
// aqui procuramos ocorrências no meio da frase. Só consideramos código COM sufixo de letra
// ("-I", "-L"): um "1.4" solto é ambíguo demais (casaria com "versão 1.4", "1.4 milhões") e
// geraria falso positivo. Mesma cautela da etapa 1 de menus-mencionados.
const CODIGO_NO_TEXTO = /\d{1,2}\.\d{1,2}-[A-Za-z](?:\/[A-Za-z])*/g;

/**
 * Códigos de menu citados num texto livre (ex.: `menusAbordados`) que NÃO existem no catálogo.
 * Não reescreve o texto — só devolve a lista, para sinalizar ao revisor. Deduplicado.
 */
export function codigosInexistentesNoTexto(
  texto: string,
  validos: Set<string>,
): string[] {
  if (validos.size === 0 || !texto) return [];
  const fora = new Set<string>();
  for (const m of texto.matchAll(CODIGO_NO_TEXTO)) {
    const cod = m[0].toUpperCase();
    if (!validos.has(cod)) fora.add(cod);
  }
  return [...fora];
}
