import {
  BorderStyle,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

/** Equivalentes em Node/TypeScript dos helpers .docx repetidos nos geradores Python
 * (`_shade_header()` e `_table()`), para o porte exigido pelos Padrões da Rech (§4.2/§4.7).
 * Mesmas cores e mesmo estilo de grade do original — o porte é de EQUIVALÊNCIA. */

const AZUL_CABECALHO = '1F4E78';

/** Bordas equivalentes ao estilo "Table Grid" do original. */
export const GRADE = {
  top: { style: BorderStyle.SINGLE, size: 1 },
  bottom: { style: BorderStyle.SINGLE, size: 1 },
  left: { style: BorderStyle.SINGLE, size: 1 },
  right: { style: BorderStyle.SINGLE, size: 1 },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
  insideVertical: { style: BorderStyle.SINGLE, size: 1 },
};

/** Célula de conteúdo simples. */
export function celula(texto: string): TableCell {
  return new TableCell({ children: [new Paragraph(texto)] });
}

/** Célula de rótulo, em negrito (coluna da esquerda das tabelas "Campo/Valor"). */
export function celulaRotulo(texto: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: [new TextRun({ text: texto, bold: true })] }),
    ],
  });
}

/** Célula de cabeçalho: fundo azul, texto branco e negrito — `_shade_header()`. */
export function celulaCabecalho(texto: string): TableCell {
  return new TableCell({
    shading: { fill: AZUL_CABECALHO },
    children: [
      new Paragraph({
        children: [new TextRun({ text: texto, bold: true, color: 'FFFFFF' })],
      }),
    ],
  });
}

/** Tabela com linha de cabeçalho sombreada e grade — `_table()`. */
export function tabelaComCabecalho(
  cabecalhos: string[],
  linhas: string[][],
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: GRADE,
    rows: [
      new TableRow({ children: cabecalhos.map(celulaCabecalho) }),
      ...linhas.map(
        (linha) =>
          new TableRow({ children: linha.map((v) => celula(String(v))) }),
      ),
    ],
  });
}
