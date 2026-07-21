import { Alignment, Borders, Fill, Font, Worksheet } from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

/** Equivalentes em Node/TypeScript dos helpers de `tools/_common.py`, para o porte dos
 * geradores Office exigido pelos Padrões da Rech (§4.2/§4.7 — Python fora da stack).
 *
 * Os estilos abaixo reproduzem os do original (mesma cor, mesma fonte, mesma borda) porque
 * o porte é de EQUIVALÊNCIA funcional (§4.7 passo 5): melhoria visual, se houver, vem depois
 * e separada. A equivalência é provada contra os snapshots de `tools/caracterizacao/`. */

// tools/data — os geradores leem os mesmos YAMLs do original, sem duplicar dado.
export const DATA_DIR = join(process.cwd(), '..', 'tools', 'data');
// exemplos/ — mesma pasta de saída do original.
export const OUT_DIR = join(process.cwd(), '..', 'exemplos');

export const HEADER_FILL: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E78' },
};
export const HEADER_FONT: Partial<Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};
export const TITLE_FONT: Partial<Font> = {
  bold: true,
  size: 16,
  color: { argb: 'FF1F4E78' },
};
export const SUB_FONT: Partial<Font> = {
  italic: true,
  color: { argb: 'FF595959' },
};

const THIN = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } };
export const BORDER: Partial<Borders> = {
  left: THIN,
  right: THIN,
  top: THIN,
  bottom: THIN,
};
export const WRAP: Partial<Alignment> = { wrapText: true, vertical: 'top' };
export const CENTER: Partial<Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
  wrapText: true,
};

/** Lê um YAML de `tools/data` (mesma fonte do gerador Python). */
export function carregarYaml<T = Record<string, unknown>>(nome: string): T {
  const caminho = join(DATA_DIR, nome);
  return (load(readFileSync(caminho, 'utf8')) ?? {}) as T;
}

/** Data de hoje em dd/mm/aaaa — equivale a `_common.today()`. */
export function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Equivale a `_common.slug()`: sem acento, não alfanumérico vira "_". Aceita só tipos
 * primitivos — objeto viraria "[object Object]" no nome do arquivo, o que é bug, não uso. */
export function slug(texto: string | number | null | undefined): string {
  const semAcento = String(texto ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
  const limpo = semAcento
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpo || 'cliente';
}

/** Cabeçalho da tabela (linha 1) com estilo e painel congelado — `_common.header_row()`. */
export function linhaCabecalho(
  ws: Worksheet,
  titulos: string[],
  linha = 1,
): void {
  titulos.forEach((texto, i) => {
    const c = ws.getCell(linha, i + 1);
    c.value = texto;
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = CENTER;
    c.border = BORDER;
  });
  ws.getRow(linha).height = 28;
  ws.views = [{ state: 'frozen', ySplit: linha }];
}

/** Larguras das colunas — `_common.set_widths()`. */
export function definirLarguras(ws: Worksheet, larguras: number[]): void {
  larguras.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/** Escreve as linhas de dados a partir da linha 2 — `_common.write_rows()`. */
export function escreverLinhas(
  ws: Worksheet,
  linhas: string[][],
  inicio = 2,
): void {
  linhas.forEach((linha, r) => {
    linha.forEach((valor, c) => {
      const cell = ws.getCell(inicio + r, c + 1);
      cell.value = valor;
      cell.alignment = WRAP;
      cell.border = BORDER;
    });
  });
}

/** Bloco de título mesclado nas duas primeiras linhas — `_common.title_block()`. */
export function blocoTitulo(
  ws: Worksheet,
  titulo: string,
  subtitulo?: string,
  span = 6,
): void {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = TITLE_FONT;
  if (subtitulo) {
    ws.mergeCells(2, 1, 2, span);
    const s = ws.getCell(2, 1);
    s.value = subtitulo;
    s.font = SUB_FONT;
  }
}
