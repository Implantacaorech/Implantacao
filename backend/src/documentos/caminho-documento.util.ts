import { isAbsolute, join, relative } from 'path';

/** Pasta física dos documentos gerados/anexados — relativa ao cwd do backend, para o
 * store inteiro poder mudar de máquina sem tocar no banco (plano de migração para o
 * servidor dedicado, docs/migracao-servidor.md §1.3). */
export function storeDocumentos(): string {
  return join(process.cwd(), 'dados', 'documentos_gerados');
}

/** Caminho a PERSISTIR em `documentos.caminho`: arquivo dentro do store grava só o nome
 * relativo (portável entre máquinas); fora do store (não acontece hoje) mantém como veio. */
export function caminhoParaPersistir(caminho: string): string {
  const rel = relative(storeDocumentos(), caminho);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : caminho;
}

/** Resolve o caminho gravado no banco para o disco. Registros antigos (pré 2026-08-19)
 * têm caminho ABSOLUTO da máquina que os gravou — usa como está; os novos são relativos
 * ao store. É o inverso de `caminhoParaPersistir`. */
export function caminhoAbsolutoDocumento(caminho: string): string {
  return isAbsolute(caminho) ? caminho : join(storeDocumentos(), caminho);
}
