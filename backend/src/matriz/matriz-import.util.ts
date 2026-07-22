import type { Worksheet, CellValue } from 'exceljs';
import { textoAparado, textoDe } from '../common/utils/texto.util';

// Espelha webapp/matriz.py — aba 'Matriz': linha 7 = áreas (forward-fill por coluna),
// linha 8 = siglas das competências + colunas fixas (Nome/Dias/Setor/Ár/Dt.última atu),
// linhas 9+ = um técnico por linha com notas 0-10.
const FIXAS = new Set(['Nome', 'Dias', 'Setor', 'Ár', 'Dt.última atu']);

const TROCA_AREA: Record<string, string> = {
  'AREA: C': 'Controladoria',
  'AREA: R': 'Folha de Pagamento',
  'ÁREA N': 'Negócios',
  'AREA F': 'Finanças',
  'AREA: P': 'Produção',
  GERAIS: 'Gerais',
  'OUTRAS ROTINAS/COMPETÊNCIAS RELEVANTES': 'Outras rotinas',
  FORMULÁRIOS: 'Formulários',
};

function limparArea(a: string): string {
  const limpo = (a || '').replace('AREA DE CONHECIMENTO -->', '').trim();
  return TROCA_AREA[limpo] ?? (limpo || 'Outras rotinas');
}

function cellText(v: CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return cellText((v as { result: CellValue }).result);
    if ('richText' in v) {
      return v.richText.map((r) => r.text).join('');
    }
    if ('text' in v) return textoDe((v as { text: unknown }).text);
  }
  return textoAparado(v);
}

export interface CompetenciaLida {
  sigla: string;
  area: string;
  ordem: number;
}

export interface TecnicoLido {
  nome: string;
  setor: string;
  dias: string;
  notas: Record<string, number>;
}

export function parseMatrizWorksheet(ws: Worksheet): {
  comps: CompetenciaLida[];
  tecnicos: TecnicoLido[];
} {
  // `actualColumnCount`/`actualRowCount` são uma CONTAGEM de linhas/colunas com valor, não
  // o maior índice usado — com linhas 1-6 vazias (só a partir da 7 há conteúdo), essa
  // contagem fica menor que o índice da última linha e trunca a varredura. `columnCount`/
  // `rowCount` refletem o maior índice já tocado, que é o que precisamos aqui.
  const maxCol = ws.columnCount;
  const maxRow = ws.rowCount;

  const areaPorCol: Record<number, string> = {};
  let atual = '';
  for (let c = 1; c <= maxCol; c++) {
    const s = cellText(ws.getRow(7).getCell(c).value);
    if (s) atual = s;
    areaPorCol[c] = atual;
  }

  const comps: CompetenciaLida[] = [];
  const colSigla: Record<number, string> = {};
  let colNome = 2;
  let colDias = 3;
  let colSetor = 4;
  let ordem = 0;
  for (let c = 1; c <= maxCol; c++) {
    const s = cellText(ws.getRow(8).getCell(c).value);
    if (!s) continue;
    if (s === 'Nome') colNome = c;
    else if (s === 'Dias') colDias = c;
    else if (s === 'Setor') colSetor = c;
    if (FIXAS.has(s)) continue;
    ordem += 1;
    comps.push({ sigla: s, area: limparArea(areaPorCol[c]), ordem });
    colSigla[c] = s;
  }

  const tecnicos: TecnicoLido[] = [];
  for (let r = 9; r <= maxRow; r++) {
    const nome = cellText(ws.getRow(r).getCell(colNome).value);
    if (!nome) continue;
    const notas: Record<string, number> = {};
    for (const [colStr, sigla] of Object.entries(colSigla)) {
      const v = ws.getRow(r).getCell(Number(colStr)).value;
      if (v == null || v === '') continue;
      const f = parseFloat(cellText(v).replace(',', '.'));
      if (Number.isNaN(f)) continue;
      notas[sigla] = Math.max(0, Math.min(10, Math.trunc(f)));
    }
    tecnicos.push({
      nome,
      setor: cellText(ws.getRow(r).getCell(colSetor).value),
      dias: cellText(ws.getRow(r).getCell(colDias).value),
      notas,
    });
  }

  return { comps, tecnicos };
}
