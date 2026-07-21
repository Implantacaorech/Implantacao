import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  CENTER,
  HEADER_FILL,
  HEADER_FONT,
  OUT_DIR,
  SUB_FONT,
  TITLE_FONT,
  ValorCelula,
  WRAP,
  blocoTitulo,
  carregarYaml,
  definirLarguras,
  escreverLinhas,
  hoje,
  linhaCabecalho,
  slug,
} from './comum';

/** Porte de `tools/gerar_log_fitgap.py` para Node/TypeScript (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Log de Fit/Gap (.xlsx): aderência de cada processo ao padrão do SIGER® e a decisão
 * (padrão / configuração / desenvolvimento / fora de escopo), com resumo de esforço e a
 * governança de customização. Porte de EQUIVALÊNCIA — prova em `gerar-log-fitgap.spec.ts`. */

const COLS = [
  'ID',
  'Processo',
  'Área',
  'Aderência',
  'Decisão',
  'RNS vinculada',
  'Esforço (h)',
  'Prioridade',
  'Status',
];
const WIDTHS = [8, 44, 18, 20, 20, 16, 12, 12, 16];
// Já sanitizado: nome de aba do Excel não aceita "/".
const SHEET = 'Log Fit-Gap';

interface ItemFitGap {
  processo?: string;
  area?: string;
  aderencia?: string;
  decisao?: string;
  rns?: string;
  esforco_h?: number;
  prioridade?: string;
}
interface DadosFitGap {
  governanca?: string;
  itens?: ItemFitGap[];
}
interface Cliente {
  nome?: string;
  codigo_sicla?: string;
}
interface DadosCliente {
  cliente?: Cliente;
}

function montarCapa(wb: Workbook, cliente: Cliente, governanca: string): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [26, 64]);
  blocoTitulo(
    ws,
    'Log de Fit/Gap — Aderência ao SIGER®',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  const info: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Código SICLA', cliente.codigo_sicla ?? ''],
  ];
  let r = 4;
  for (const [rotulo, valor] of info) {
    const a = ws.getCell(r, 1);
    a.value = rotulo;
    a.font = HEADER_FONT;
    a.fill = HEADER_FILL;
    a.alignment = WRAP;
    const b = ws.getCell(r, 2);
    b.value = valor;
    b.alignment = WRAP;
    r += 1;
  }
  const gv = ws.getCell(r + 1, 1);
  gv.value = 'Governança de customização';
  gv.font = TITLE_FONT;
  // Bloco de governança ocupa 3 linhas x 2 colunas, como no original.
  ws.mergeCells(r + 2, 1, r + 4, 2);
  const texto = ws.getCell(r + 2, 1);
  texto.value = governanca;
  texto.alignment = WRAP;
}

function montarLog(wb: Workbook, itens: ItemFitGap[]): number {
  const ws = wb.addWorksheet(SHEET);
  linhaCabecalho(ws, COLS);
  definirLarguras(ws, WIDTHS);
  const linhas: ValorCelula[][] = itens.map((it, i) => [
    `FG-${String(i + 1).padStart(2, '0')}`,
    it.processo ?? '',
    it.area ?? '',
    it.aderencia ?? '',
    it.decisao ?? '',
    it.rns ?? '',
    it.esforco_h ?? 0,
    it.prioridade ?? '',
    'Em aberto',
  ]);
  escreverLinhas(ws, linhas);

  const listas: [string, string][] = [
    ['D', 'Standard,Standard (configuração),Parcial,Gap'],
    ['E', 'Usar padrão,Configuração,Desenvolvimento,Fora de escopo'],
    ['I', 'Em aberto,Aprovado,Concluído,Cancelado'],
  ];
  for (const [coluna, opcoes] of listas) {
    for (let r = 2; r <= linhas.length + 1; r += 1) {
      ws.getCell(`${coluna}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${opcoes}"`],
      };
    }
  }
  return linhas.length;
}

function montarResumo(wb: Workbook): void {
  const ws = wb.addWorksheet('Resumo');
  definirLarguras(ws, [28, 16, 44]);
  blocoTitulo(ws, 'Resumo do Fit/Gap', undefined, 3);
  const metricas: [string, string][] = [
    ['Usar padrão', `COUNTIF('${SHEET}'!E:E,"Usar padrão")`],
    ['Configuração', `COUNTIF('${SHEET}'!E:E,"Configuração")`],
    ['Desenvolvimento', `COUNTIF('${SHEET}'!E:E,"Desenvolvimento")`],
    ['Fora de escopo', `COUNTIF('${SHEET}'!E:E,"Fora de escopo")`],
    [
      'Esforço dev (h)',
      `SUMIF('${SHEET}'!E:E,"Desenvolvimento",'${SHEET}'!G:G)`,
    ],
  ];
  metricas.forEach(([rotulo, formula], i) => {
    const r = 4 + i;
    const a = ws.getCell(r, 1);
    a.value = rotulo;
    a.font = HEADER_FONT;
    a.fill = HEADER_FILL;
    a.alignment = WRAP;
    const b = ws.getCell(r, 2);
    b.value = { formula };
    b.alignment = CENTER;
  });
  const r = 4 + metricas.length + 1;
  const nota = ws.getCell(r, 1);
  nota.value =
    'Quanto menos desenvolvimento, menor o custo e o risco. ' +
    'Reavaliar todo Gap antes de aprovar customização.';
  nota.font = SUB_FONT;
  nota.alignment = WRAP;
  ws.mergeCells(r, 1, r, 3);
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  fitgap: DadosFitGap = carregarYaml<DadosFitGap>('fitgap.yaml'),
): Workbook {
  const wb = new Workbook();
  montarCapa(wb, cliente.cliente ?? {}, fitgap.governanca ?? '');
  montarLog(wb, fitgap.itens ?? []);
  montarResumo(wb);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Log_FitGap_${slug(cliente.cliente?.nome)}.xlsx`,
  );
  await wb.xlsx.writeFile(caminho);
  return caminho;
}

if (require.main === module) {
  gerar()
    .then((caminho) => console.log(`OK: ${caminho}`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });
}
