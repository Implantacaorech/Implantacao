/** Entrega um Blob ao usuário como download do navegador — âncora temporária com URL de
 * objeto, revogada após o clique. Ponto único do app: antes eram 7 cópias idênticas
 * (`baixarNoNavegador`/`baixarBlob`) espalhadas pelas features (consolidado em 2026-08-19). */
export function baixarArquivo(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
