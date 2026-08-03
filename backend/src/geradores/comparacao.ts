import { Workbook } from 'exceljs';
import { readFileSync } from 'fs';
import { join } from 'path';

/** Utilitário de prova de EQUIVALÊNCIA do porte dos geradores (§4.7 dos Padrões da Rech).
 *
 * Extrai de um workbook exatamente o mesmo contrato observável que o harness Python
 * (`tools/caracterizacao.py`) extrai do gerador original, para que os dois possam ser
 * comparados célula a célula. Não se compara byte a byte: .xlsx é ZIP com timestamp
 * embutido, então arquivos idênticos em conteúdo têm bytes diferentes. */

export interface SnapshotXlsx {
  tipo: string;
  abas_ordem: string[];
  abas: Record<string, string[][]>;
}

/** Data de hoje em dd/mm/aaaa — a única que é mascarada. */
function dataDeHoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const HOJE = dataDeHoje();

/** Onde a data de GERAÇÃO aparece nas planilhas: sempre atrás de um rótulo. Nos 8 snapshots
 * .xlsx que têm `<HOJE>`, a célula é "<Cliente> · gerado em <data>". */
const ROTULO_GERACAO = /(gerado em|Atualizado em)\s+/i;

/** Só a data de GERAÇÃO sai do contrato. As datas de negócio (virada, prazos, dias do
 * hypercare) permanecem — é nelas que um erro de aritmética de datas apareceria, e
 * mascará-las cegaria o teste justamente ali.
 *
 * Por que casar o RÓTULO, e não a data solta: a máscara antiga trocava QUALQUER célula igual
 * à data de hoje, sem saber se era geração ou negócio. Isso fez exatamente o que o parágrafo
 * acima diz que não pode acontecer — em 02/08/2026 o dia 2 do hypercare (fixture começando
 * em 01/08/2026) virou `<HOJE>` e a suíte quebrou sozinha, sem ninguém mexer em nada. Seria
 * assim todo dia em que uma data de negócio das fixtures calhasse de ser hoje. */
function mascarar(valor: string): string {
  if (!valor.includes(HOJE)) return valor;
  return valor.replace(
    new RegExp(`(${ROTULO_GERACAO.source})${HOJE.replace(/\//g, '\\/')}`, 'gi'),
    '$1<HOJE>',
  );
}

/** Texto de uma célula com a MESMA semântica do openpyxl usado no harness Python. */
function textoDaCelula(valor: unknown, ehEscrava: boolean): string {
  if (ehEscrava || valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean')
    return String(valor);
  // Fórmula: o openpyxl (data_only=False) devolve o texto "=...", e é assim que está no
  // snapshot. O exceljs devolve { formula, result } — normalizamos para o mesmo formato.
  if (typeof valor === 'object' && 'formula' in valor) {
    const f = (valor as { formula: string }).formula;
    return f.startsWith('=') ? f : `=${f}`;
  }
  if (valor instanceof Date) return valor.toISOString();
  return JSON.stringify(valor);
}

/** Extrai o conteúdo observável do workbook (abas na ordem + células preenchidas). */
export function extrairXlsx(wb: Workbook): SnapshotXlsx {
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
        valores.push(mascarar(textoDaCelula(cell.value, ehEscrava)));
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

  return { tipo: 'xlsx', abas_ordem: wb.worksheets.map((ws) => ws.name), abas };
}

/** Carrega o snapshot dourado gerado a partir do gerador Python original. */
export function carregarSnapshot(nomeModuloPython: string): SnapshotXlsx {
  const caminho = join(
    process.cwd(),
    '..',
    'tools',
    'caracterizacao',
    `${nomeModuloPython}.json`,
  );
  return JSON.parse(readFileSync(caminho, 'utf8')) as SnapshotXlsx;
}
