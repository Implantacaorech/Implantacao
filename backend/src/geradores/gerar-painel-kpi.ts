import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  BORDER,
  CENTER,
  HEADER_FILL,
  HEADER_FONT,
  OUT_DIR,
  WRAP,
  blocoTitulo,
  carregarYaml,
  definirLarguras,
  escreverLinhas,
  hoje,
  linhaCabecalho,
  slug,
} from './comum';

/** Porte de `tools/gerar_painel_kpi.py` para Node/TypeScript (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Painel de KPIs da implantação (.xlsx): indicadores de resultado, marcos (prazo) e
 * horas (planejado x real). Porte de EQUIVALÊNCIA — as fórmulas do Excel são reproduzidas
 * literalmente, porque é o que o consultor usa na planilha. Prova em `gerar-painel-kpi.spec.ts`. */

interface Indicador {
  kpi?: string;
  categoria?: string;
  meta?: string;
  medicao?: string;
}
interface Horas {
  etapa?: string;
}
interface DadosKpi {
  indicadores?: Indicador[];
  marcos?: string[];
  horas?: Horas[];
}
interface Cliente {
  nome?: string;
  codigo_sicla?: string;
  rns_implantacao?: string;
  data_virada_prevista?: string;
}
interface DadosCliente {
  cliente?: Cliente;
}

function montarCapa(wb: Workbook, cliente: Cliente): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [26, 60]);
  blocoTitulo(
    ws,
    'Painel de KPIs da Implantação',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  const campos: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Código SICLA', cliente.codigo_sicla ?? ''],
    ['RNS de Implantação', cliente.rns_implantacao ?? ''],
    ['Virada prevista', cliente.data_virada_prevista ?? ''],
  ];
  campos.forEach(([rotulo, valor], i) => {
    const linha = 4 + i;
    const a = ws.getCell(linha, 1);
    a.value = rotulo;
    a.font = HEADER_FONT;
    a.fill = HEADER_FILL;
    a.alignment = WRAP;
    const b = ws.getCell(linha, 2);
    b.value = valor;
    b.alignment = WRAP;
  });
}

function montarKpis(wb: Workbook, indicadores: Indicador[]): void {
  const ws = wb.addWorksheet('Painel de KPIs');
  linhaCabecalho(ws, [
    'KPI',
    'Categoria',
    'Meta',
    'Medição',
    'Valor atual',
    'Farol',
  ]);
  definirLarguras(ws, [30, 16, 30, 34, 16, 12]);
  const linhas = indicadores.map((i) => [
    i.kpi ?? '',
    i.categoria ?? '',
    i.meta ?? '',
    i.medicao ?? '',
    '',
    '',
  ]);
  escreverLinhas(ws, linhas);
  for (let r = 2; r <= linhas.length + 1; r += 1) {
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Verde,Amarelo,Vermelho"'],
    };
  }
}

function montarMarcos(wb: Workbook, marcos: string[]): void {
  const ws = wb.addWorksheet('Marcos (Prazo)');
  linhaCabecalho(ws, ['Marco', 'Data prevista', 'Data real', 'Desvio (dias)']);
  definirLarguras(ws, [34, 16, 16, 14]);
  marcos.forEach((marco, i) => {
    const r = i + 2;
    const a = ws.getCell(r, 1);
    a.value = marco;
    a.alignment = WRAP;
    const d = ws.getCell(r, 4);
    d.value = { formula: `IF(AND(B${r}<>"",C${r}<>""),C${r}-B${r},"")` };
    d.alignment = CENTER;
    for (const col of [2, 3]) ws.getCell(r, col).border = BORDER;
  });
}

function montarHoras(wb: Workbook, horas: Horas[]): void {
  const ws = wb.addWorksheet('Horas (Plan x Real)');
  linhaCabecalho(ws, [
    'Macro-etapa',
    'Horas planejadas',
    'Horas reais',
    'Desvio',
    '% do plano',
  ]);
  definirLarguras(ws, [30, 16, 16, 12, 12]);
  horas.forEach((h, i) => {
    const r = i + 2;
    const a = ws.getCell(r, 1);
    a.value = h.etapa ?? '';
    a.alignment = WRAP;
    const desvio = ws.getCell(r, 4);
    desvio.value = { formula: `IF(AND(B${r}<>"",C${r}<>""),C${r}-B${r},"")` };
    desvio.alignment = CENTER;
    const pct = ws.getCell(r, 5);
    pct.value = { formula: `IF(B${r}>0,C${r}/B${r},"")` };
    pct.alignment = CENTER;
    pct.numFmt = '0%';
    for (const col of [2, 3]) ws.getCell(r, col).border = BORDER;
  });
  // Linha de total, logo abaixo da última etapa.
  const r = horas.length + 2;
  const t = ws.getCell(r, 1);
  t.value = 'TOTAL';
  t.font = HEADER_FONT;
  ws.getCell(r, 2).value = { formula: `SUM(B2:B${r - 1})` };
  ws.getCell(r, 3).value = { formula: `SUM(C2:C${r - 1})` };
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  kpi: DadosKpi = carregarYaml<DadosKpi>('kpi.yaml'),
): Workbook {
  const wb = new Workbook();
  montarCapa(wb, cliente.cliente ?? {});
  montarKpis(wb, kpi.indicadores ?? []);
  montarMarcos(wb, kpi.marcos ?? []);
  montarHoras(wb, kpi.horas ?? []);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Painel_KPIs_${slug(cliente.cliente?.nome)}.xlsx`,
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
