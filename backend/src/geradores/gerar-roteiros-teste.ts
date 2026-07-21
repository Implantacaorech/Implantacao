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
  nomeAbaSeguro,
  slug,
} from './comum';

/** Porte de `tools/gerar_roteiros_teste.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera a planilha de Roteiros SIT/UAT (.xlsx) — uma aba por módulo, com registro de defeitos
 * e o painel de sign-off que funciona como gate da virada. Porte de EQUIVALÊNCIA — prova em
 * `gerar-roteiros-teste.spec.ts`. */

const STATUS_OPCOES = 'Não testado,Aprovado,Reprovado,Bloqueado';
const COLS = [
  'ID',
  'Tipo',
  'Criticidade',
  'Cenário',
  'Pré-requisitos',
  'Passos',
  'Resultado esperado',
  'Status',
  'Resultado obtido',
  'Defeito',
  'Testado por',
  'Data',
];
const WIDTHS = [10, 8, 12, 34, 28, 40, 38, 14, 30, 12, 16, 12];

interface Caso {
  id?: string;
  tipo?: string;
  criticidade?: string;
  cenario?: string;
  pre_requisitos?: string;
  passos?: string[];
  resultado_esperado?: string;
}
interface Modulo {
  nome: string;
  casos?: Caso[];
}
interface DadosRoteiros {
  modulos?: Modulo[];
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

function montarAbaModulo(wb: Workbook, mod: Modulo): string {
  const ws = wb.addWorksheet(nomeAbaSeguro(mod.nome));
  linhaCabecalho(ws, COLS);
  definirLarguras(ws, WIDTHS);
  const linhas: ValorCelula[][] = (mod.casos ?? []).map((caso) => [
    caso.id ?? '',
    caso.tipo ?? '',
    caso.criticidade ?? '',
    caso.cenario ?? '',
    caso.pre_requisitos ?? '',
    (caso.passos ?? []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    caso.resultado_esperado ?? '',
    'Não testado',
    '',
    '',
    '',
    '',
  ]);
  escreverLinhas(ws, linhas);
  for (let r = 2; r <= linhas.length + 1; r += 1) {
    ws.getCell(`H${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${STATUS_OPCOES}"`],
    };
  }
  return ws.name;
}

function montarCapa(wb: Workbook, cliente: Cliente, modulos: string[]): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [24, 60]);
  blocoTitulo(
    ws,
    'Roteiros de Teste — SIT / UAT',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  const info: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Código SICLA', cliente.codigo_sicla ?? ''],
    ['RNS de Implantação', cliente.rns_implantacao ?? ''],
    ['Virada prevista', cliente.data_virada_prevista ?? ''],
    ['Módulos no escopo', modulos.join(', ')],
    ['', ''],
    [
      'SIT',
      'Teste Integrado — executado pelo consultor (integração entre módulos)',
    ],
    [
      'UAT',
      'Aceite do Usuário — executado pelo cliente (valida o processo real)',
    ],
    ['Legenda Status', 'Não testado · Aprovado · Reprovado · Bloqueado'],
    [
      'Gate da virada',
      '≥ 95% dos casos UAT Aprovados e 0 defeitos de severidade Crítica',
    ],
  ];
  info.forEach(([rotulo, valor], i) => {
    const r = 4 + i;
    const a = ws.getCell(r, 1);
    a.value = rotulo;
    // A linha em branco separa os dados do cliente das legendas; ela usa a fonte de
    // subtítulo e não recebe preenchimento, como no original.
    a.font = rotulo ? HEADER_FONT : SUB_FONT;
    if (rotulo) {
      a.fill = HEADER_FILL;
      a.alignment = WRAP;
    }
    const b = ws.getCell(r, 2);
    b.value = valor;
    b.alignment = WRAP;
  });
}

function montarDefeitos(wb: Workbook): void {
  const ws = wb.addWorksheet('Registro de Defeitos');
  linhaCabecalho(ws, [
    'ID',
    'Caso (ID)',
    'Módulo',
    'Descrição do defeito',
    'Severidade',
    'Status',
    'Responsável',
    'Aberto em',
    'Resolvido em',
  ]);
  definirLarguras(ws, [10, 12, 22, 46, 14, 14, 18, 14, 14]);
  // Preenchida à mão durante os testes: as listas cobrem 200 linhas, como no original.
  const listas: [string, string][] = [
    ['E', 'Crítica,Alta,Média,Baixa'],
    ['F', 'Aberto,Em análise,Resolvido,Fechado'],
  ];
  for (const [coluna, opcoes] of listas) {
    for (let r = 2; r <= 200; r += 1) {
      ws.getCell(`${coluna}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${opcoes}"`],
      };
    }
  }
}

function montarResumo(wb: Workbook, abasModulos: string[]): void {
  const ws = wb.addWorksheet('Resumo e Sign-off');
  definirLarguras(ws, [28, 18, 50]);
  blocoTitulo(ws, 'Resumo dos Testes e Liberação', undefined, 3);

  // Métricas vivas: soma o COUNTIF da coluna Status de cada aba de módulo.
  const soma = (status: string): string =>
    abasModulos.length > 0
      ? abasModulos.map((s) => `COUNTIF('${s}'!H:H,"${status}")`).join('+')
      : '0';
  const metricas: [string, string][] = [
    ['Casos Aprovados', soma('Aprovado')],
    ['Casos Reprovados', soma('Reprovado')],
    ['Casos Bloqueados', soma('Bloqueado')],
    ['Casos Não testados', soma('Não testado')],
  ];
  const r0 = 4;
  metricas.forEach(([rotulo, formula], i) => {
    const r = r0 + i;
    const a = ws.getCell(r, 1);
    a.value = rotulo;
    a.font = HEADER_FONT;
    a.fill = HEADER_FILL;
    a.alignment = WRAP;
    const b = ws.getCell(r, 2);
    b.value = { formula };
    b.alignment = CENTER;
  });

  const rg = r0 + metricas.length + 1;
  const g = ws.getCell(rg, 1);
  g.value = 'Gate da virada';
  g.font = HEADER_FONT;
  g.fill = HEADER_FILL;
  g.alignment = WRAP;
  ws.mergeCells(rg, 2, rg, 3);
  const criterio = ws.getCell(rg, 2);
  criterio.value =
    'Liberar a virada somente com ≥ 95% dos casos UAT Aprovados e 0 defeitos Críticos em aberto.';
  criterio.alignment = WRAP;

  const rs = rg + 2;
  const tit = ws.getCell(rs, 1);
  tit.value = 'Assinaturas';
  tit.font = TITLE_FONT;
  const papeis = [
    'Consultor de Implantação',
    'Usuário Líder (cliente)',
    'Gerente do Projeto',
  ];
  papeis.forEach((papel, i) => {
    const r = rs + 2 + i * 2;
    ws.getCell(r, 1).value = '__________________________';
    const p = ws.getCell(r + 1, 1);
    p.value = papel;
    p.font = SUB_FONT;
  });
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  rot: DadosRoteiros = carregarYaml<DadosRoteiros>('roteiros_teste.yaml'),
): Workbook {
  const modulos = rot.modulos ?? [];
  const wb = new Workbook();
  montarCapa(
    wb,
    cliente.cliente ?? {},
    modulos.map((m) => m.nome),
  );
  const abas = modulos.map((mod) => montarAbaModulo(wb, mod));
  montarDefeitos(wb);
  montarResumo(wb, abas);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Roteiros_SIT_UAT_${slug(cliente.cliente?.nome)}.xlsx`,
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
