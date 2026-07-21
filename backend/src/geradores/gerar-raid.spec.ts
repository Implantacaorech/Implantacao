import { Workbook } from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { montarWorkbook } from './gerar-raid';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4): a saída do gerador em
 * Node/TypeScript tem de reproduzir o conteúdo do gerador Python original, medido pelo mesmo
 * contrato observável capturado em `tools/caracterizacao/gerar_raid.json` — abas na ordem e
 * células preenchidas, com datas mascaradas.
 *
 * Não se compara byte a byte: .xlsx é ZIP com timestamp embutido, então arquivos idênticos em
 * conteúdo têm bytes diferentes. */

const SNAPSHOT = join(
  process.cwd(),
  '..',
  'tools',
  'caracterizacao',
  'gerar_raid.json',
);

interface SnapshotXlsx {
  tipo: string;
  abas_ordem: string[];
  abas: Record<string, string[][]>;
}

const RE_DATA = /\b\d{2}\/\d{2}\/\d{4}\b/g;

/** Mesma máscara do harness Python: a data de hoje não pode entrar no contrato. */
function mascarar(valor: string): string {
  return valor.replace(RE_DATA, '<DATA>');
}

/** Extrai o conteúdo do workbook com a MESMA semântica do `extrair_xlsx` em Python:
 * célula vazia vira "", cauda de células vazias e de linhas vazias é descartada. */
function extrair(wb: Workbook): SnapshotXlsx {
  const abasOrdem = wb.worksheets.map((ws) => ws.name);
  const abas: Record<string, string[][]> = {};

  for (const ws of wb.worksheets) {
    const linhas: string[][] = [];
    for (let r = 1; r <= ws.rowCount; r += 1) {
      const valores: string[] = [];
      for (let c = 1; c <= ws.columnCount; c += 1) {
        const cell = ws.getCell(r, c);
        // Em célula mesclada o openpyxl deixa o valor SÓ na âncora (as demais são None),
        // enquanto o exceljs devolve o valor da âncora em todas. Espelhamos o openpyxl.
        const ehEscrava =
          cell.isMerged && cell.master?.address !== cell.address;
        // Os geradores só escrevem texto/número; qualquer outra coisa aqui é sinal de que o
        // porte divergiu, então converter explicitamente em vez de aceitar "[object Object]".
        const valor = cell.value;
        const bruto =
          ehEscrava || valor === null || valor === undefined
            ? ''
            : typeof valor === 'string'
              ? valor
              : typeof valor === 'number' || typeof valor === 'boolean'
                ? String(valor)
                : JSON.stringify(valor);
        valores.push(mascarar(bruto));
      }
      while (valores.length > 0 && valores[valores.length - 1] === '')
        valores.pop();
      linhas.push(valores);
    }
    while (
      linhas.length > 0 &&
      !linhas[linhas.length - 1].some((v) => v !== '')
    )
      linhas.pop();
    abas[ws.name] = linhas;
  }

  return { tipo: 'xlsx', abas_ordem: abasOrdem, abas };
}

describe('gerar-raid (porte de tools/gerar_raid.py)', () => {
  const esperado = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as SnapshotXlsx;
  const atual = extrair(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('mantém os IDs numerados como o original (R-01, A-01, DP-01…)', () => {
    expect(atual.abas['Riscos'][1][0]).toBe('R-01');
    expect(atual.abas['Premissas'][1][0]).toBe('A-01');
    expect(atual.abas['Dependências'][1][0]).toBe('DP-01');
  });
});
