import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  BORDER,
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

/** Porte de `tools/gerar_reconciliacao_conversao.py` para Node/TS (§4.2/§4.7 dos Padrões da
 * Rech).
 *
 * Gera a planilha de Reconciliação de Conversão (.xlsx): confere contagem e valores
 * origem × destino por entidade, registra as cargas (mock loads) e o sign-off dos dados
 * convertidos. Porte de EQUIVALÊNCIA — prova em `gerar-reconciliacao-conversao.spec.ts`. */

const COLS = [
  'Entidade',
  'Chave',
  'RNS COB',
  'Qtd Origem',
  'Qtd Destino',
  'Dif. Qtd',
  'Valor Origem (R$)',
  'Valor Destino (R$)',
  'Dif. Valor',
  'Amostra OK?',
  'Status',
  'Observação',
];
const WIDTHS = [34, 16, 12, 12, 12, 10, 16, 16, 12, 12, 14, 40];

interface Entidade {
  nome?: string;
  chave?: string;
  rns_cob?: string;
  obs?: string;
}
interface Carga {
  tipo?: string;
}
interface DadosConversao {
  criterios_aceite?: string[];
  entidades?: Entidade[];
  cargas?: Carga[];
}
interface Cliente {
  nome?: string;
  codigo_sicla?: string;
  data_virada_prevista?: string;
}
interface DadosCliente {
  cliente?: Cliente;
}

function montarCapa(wb: Workbook, cliente: Cliente, criterios: string[]): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [26, 60]);
  blocoTitulo(
    ws,
    'Reconciliação de Conversão',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  // A 4ª entrada é uma linha em branco proposital, separando os dados do cliente
  // do par Origem/Destino — por isso o rótulo vazio não recebe estilo de cabeçalho.
  const info: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Código SICLA', cliente.codigo_sicla ?? ''],
    ['Virada prevista', cliente.data_virada_prevista ?? ''],
    ['', ''],
    ['Origem', 'Sistema antigo do cliente'],
    ['Destino', 'SIGER®'],
  ];
  let r = 4;
  for (const [rotulo, valor] of info) {
    const a = ws.getCell(r, 1);
    a.value = rotulo;
    if (rotulo) {
      a.font = HEADER_FONT;
      a.fill = HEADER_FILL;
    }
    a.alignment = WRAP;
    const b = ws.getCell(r, 2);
    b.value = valor;
    b.alignment = WRAP;
    r += 1;
  }
  const tit = ws.getCell(r + 1, 1);
  tit.value = 'Critérios de aceite';
  tit.font = TITLE_FONT;
  criterios.forEach((crit, i) => {
    const linha = r + 2 + i;
    const c = ws.getCell(linha, 1);
    c.value = `• ${crit}`;
    c.alignment = WRAP;
    ws.mergeCells(linha, 1, linha, 2);
  });
}

function montarReconciliacao(wb: Workbook, entidades: Entidade[]): void {
  const ws = wb.addWorksheet('Reconciliação');
  linhaCabecalho(ws, COLS);
  definirLarguras(ws, WIDTHS);
  entidades.forEach((e, i) => {
    const r = i + 2;
    const nome = ws.getCell(r, 1);
    nome.value = e.nome ?? '';
    nome.alignment = WRAP;
    const chave = ws.getCell(r, 2);
    chave.value = e.chave ?? '';
    chave.alignment = WRAP;
    const rns = ws.getCell(r, 3);
    rns.value = e.rns_cob ?? '';
    rns.alignment = WRAP;
    // D e E ficam vazios para o consultor preencher; F é a diferença de quantidade.
    const difQtd = ws.getCell(r, 6);
    difQtd.value = { formula: `E${r}-D${r}` };
    difQtd.alignment = CENTER;
    // G e H idem; I é a diferença de valor.
    const difValor = ws.getCell(r, 9);
    difValor.value = { formula: `H${r}-G${r}` };
    difValor.alignment = CENTER;
    const obs = ws.getCell(r, 12);
    obs.value = e.obs ?? '';
    obs.alignment = WRAP;
    for (const col of [4, 5, 7, 8]) ws.getCell(r, col).border = BORDER;
  });

  const n = entidades.length;
  const listas: [string, string][] = [
    ['K', 'Conferido,Divergente,Pendente'],
    ['J', 'Sim,Não,Parcial'],
  ];
  for (const [coluna, opcoes] of listas) {
    for (let r = 2; r <= n + 1; r += 1) {
      ws.getCell(`${coluna}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${opcoes}"`],
      };
    }
  }
}

function montarCargas(wb: Workbook, cargas: Carga[]): void {
  const ws = wb.addWorksheet('Cargas (mock loads)');
  linhaCabecalho(ws, [
    'Carga',
    'Data',
    'Resultado',
    'Divergências encontradas',
    'Responsável',
  ]);
  definirLarguras(ws, [22, 16, 18, 44, 20]);
  const linhas: ValorCelula[][] = cargas.map((c) => [
    c.tipo ?? '',
    '',
    '',
    '',
    '',
  ]);
  escreverLinhas(ws, linhas);
  for (let r = 2; r <= linhas.length + 1; r += 1) {
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"OK,OK com ressalvas,Refazer"'],
    };
  }
}

function montarSignoff(wb: Workbook): void {
  const ws = wb.addWorksheet('Sign-off');
  definirLarguras(ws, [60]);
  blocoTitulo(ws, 'Aceite dos dados convertidos', undefined, 1);
  const nota = ws.getCell(4, 1);
  nota.value =
    'Liberar a conversão oficial somente com contagem e valores conferidos, ' +
    'amostra validada e divergências aceitas pelo cliente.';
  nota.alignment = WRAP;
  ws.mergeCells('A4:A5');
  const papeis = [
    'Consultor de Implantação',
    'Equipe de Conversão',
    'Usuário Líder (cliente)',
  ];
  papeis.forEach((papel, i) => {
    const r = 8 + i * 2;
    ws.getCell(r, 1).value = '__________________________';
    const p = ws.getCell(r + 1, 1);
    p.value = papel;
    p.font = SUB_FONT;
  });
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  conv: DadosConversao = carregarYaml<DadosConversao>('conversao.yaml'),
): Workbook {
  const wb = new Workbook();
  montarCapa(wb, cliente.cliente ?? {}, conv.criterios_aceite ?? []);
  montarReconciliacao(wb, conv.entidades ?? []);
  montarCargas(wb, conv.cargas ?? []);
  montarSignoff(wb);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Reconciliacao_Conversao_${slug(cliente.cliente?.nome)}.xlsx`,
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
