import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  HEADER_FILL,
  HEADER_FONT,
  OUT_DIR,
  TITLE_FONT,
  ValorCelula,
  WRAP,
  blocoTitulo,
  carregarYaml,
  definirLarguras,
  escreverLinhas,
  formatarData,
  hoje,
  linhaCabecalho,
  parseData,
  slug,
  somarDias,
} from './comum';

/** Porte de `tools/gerar_painel_hypercare.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Painel de Hypercare (.xlsx): janela de estabilização pós-virada, com registro de
 * chamados, acompanhamento diário e os critérios de saída que funcionam como gate da
 * transição para o Suporte. Porte de EQUIVALÊNCIA — prova em
 * `gerar-painel-hypercare.spec.ts`, que inclui a sequência de datas do acompanhamento. */

interface DadosHypercare {
  janela_semanas?: number;
  governanca?: string[];
  criterios_saida?: string[];
}
interface Cliente {
  nome?: string;
  data_virada_prevista?: string;
}
interface DadosCliente {
  cliente?: Cliente;
}

function montarCapa(
  wb: Workbook,
  cliente: Cliente,
  hc: DadosHypercare,
  inicio: Date | null,
  fim: Date | null,
): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [26, 62]);
  blocoTitulo(
    ws,
    'Painel de Hypercare',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  const info: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Janela', `${hc.janela_semanas ?? 4} semanas`],
    ['Início (virada)', inicio ? formatarData(inicio) : '(definir)'],
    ['Fim previsto', fim ? formatarData(fim) : '(definir)'],
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
  const gov = ws.getCell(r + 1, 1);
  gov.value = 'Governança';
  gov.font = TITLE_FONT;
  (hc.governanca ?? []).forEach((g, i) => {
    const linha = r + 2 + i;
    const c = ws.getCell(linha, 1);
    c.value = `• ${g}`;
    c.alignment = WRAP;
    ws.mergeCells(linha, 1, linha, 2);
  });
}

function montarChamados(wb: Workbook): void {
  const ws = wb.addWorksheet('Registro de Chamados');
  linhaCabecalho(ws, [
    'Data',
    'Usuário',
    'Módulo',
    'Descrição',
    'Severidade',
    'Status',
    'Resolução',
    'Tempo (h)',
  ]);
  definirLarguras(ws, [14, 20, 18, 44, 14, 14, 40, 10]);
  // A planilha é preenchida à mão pelo consultor: as listas cobrem 300 linhas, como no
  // original, para já valerem nos chamados que ele digitar depois.
  const listas: [string, string][] = [
    ['E', 'Crítica,Alta,Média,Baixa'],
    ['F', 'Aberto,Em andamento,Resolvido'],
  ];
  for (const [coluna, opcoes] of listas) {
    for (let r = 2; r <= 300; r += 1) {
      ws.getCell(`${coluna}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${opcoes}"`],
      };
    }
  }
}

function montarDiario(wb: Workbook, inicio: Date | null, dias: number): void {
  const ws = wb.addWorksheet('Acompanhamento Diário');
  linhaCabecalho(ws, [
    'Dia',
    'Data',
    'Chamados abertos',
    'Resolvidos',
    'Críticos em aberto',
    'Adesão %',
    'Observações',
  ]);
  definirLarguras(ws, [8, 14, 16, 12, 16, 12, 44]);
  const linhas: ValorCelula[][] = [];
  for (let d = 0; d < dias; d += 1) {
    linhas.push([
      d + 1,
      inicio ? formatarData(somarDias(inicio, d)) : '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }
  escreverLinhas(ws, linhas);
}

function montarCriterios(wb: Workbook, criterios: string[]): void {
  const ws = wb.addWorksheet('Critérios de Saída');
  linhaCabecalho(ws, ['Critério de saída', 'Atingido?', 'Evidência']);
  definirLarguras(ws, [56, 14, 40]);
  const linhas: ValorCelula[][] = criterios.map((c) => [c, '', '']);
  escreverLinhas(ws, linhas);
  for (let r = 2; r <= linhas.length + 1; r += 1) {
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Sim,Não,Parcial"'],
    };
  }
  const r = linhas.length + 3;
  const gate = ws.getCell(r, 1);
  gate.value =
    'GATE: só encerrar o hypercare e transferir ao Suporte com TODOS os critérios atingidos.';
  gate.font = HEADER_FONT;
  gate.fill = HEADER_FILL;
  gate.alignment = WRAP;
  ws.mergeCells(r, 1, r, 3);
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  hc: DadosHypercare = carregarYaml<DadosHypercare>('hypercare.yaml'),
): Workbook {
  const semanas = Number(hc.janela_semanas ?? 4);
  const dias = semanas * 7;
  const inicio = parseData(cliente.cliente?.data_virada_prevista);
  const fim = inicio ? somarDias(inicio, dias) : null;

  const wb = new Workbook();
  montarCapa(wb, cliente.cliente ?? {}, hc, inicio, fim);
  montarChamados(wb);
  montarDiario(wb, inicio, dias);
  montarCriterios(wb, hc.criterios_saida ?? []);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Painel_Hypercare_${slug(cliente.cliente?.nome)}.xlsx`,
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
