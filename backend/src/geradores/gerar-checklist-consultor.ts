import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  OUT_DIR,
  ValorCelula,
  blocoTitulo,
  carregarYaml,
  definirLarguras,
  escreverLinhas,
  hoje,
  linhaCabecalho,
  slug,
} from './comum';
import {
  LinhaChecklist,
  ModuloCatalogo,
  linhasDoChecklist,
  resolverModulos,
} from './catalogo';

/** Porte de `tools/gerar_checklist_consultor.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera a planilha "Check List do Consultor" (.xlsx) ao final do levantamento: os módulos
 * contratados e o roteiro de itens a percorrer, com colunas de acompanhamento. Porte de
 * EQUIVALÊNCIA — prova em `gerar-checklist-consultor.spec.ts`. */

interface DadosLevantamento {
  cliente?: string;
  client_name?: string;
  modulos_contratados?: (string | number)[];
}

function montarAbaModulos(
  wb: Workbook,
  cliente: string,
  mods: ModuloCatalogo[],
): void {
  const ws = wb.addWorksheet('Módulos Contratados');
  blocoTitulo(
    ws,
    'Módulos e Adicionais Contratados',
    `${cliente} · gerado em ${hoje()}`,
    5,
  );
  linhaCabecalho(
    ws,
    ['Código', 'Abrev.', 'Descrição', 'Área', 'Necessidade'],
    4,
  );
  definirLarguras(ws, [10, 10, 46, 34, 14]);
  const linhas: ValorCelula[][] = mods.map((m) => [
    m.codigo ?? '',
    m.abrev ?? '',
    m.descricao ?? '',
    m.area ?? '',
    'Sim',
  ]);
  escreverLinhas(ws, linhas, 5);
}

function montarAbaChecklist(
  wb: Workbook,
  linhasRoteiro: LinhaChecklist[],
): void {
  const ws = wb.addWorksheet('Roteiro e Check List');
  linhaCabecalho(ws, [
    'Módulo',
    'Adicional',
    'Tipo',
    'Integrações',
    'Item de Go-Live',
    'Menu',
    'Item',
    'Ação/Observação',
    'Sequência',
    'Status',
    'Responsável',
    'Concluído em',
  ]);
  definirLarguras(ws, [10, 10, 16, 18, 14, 10, 40, 50, 10, 14, 18, 14]);
  const linhas: ValorCelula[][] = linhasRoteiro.map((l) => [
    l.modulo ?? '',
    l.adicional ?? '',
    l.tipo ?? '',
    l.integracoes ?? '',
    l.golive ?? '',
    l.menu ?? '',
    l.item ?? '',
    l.acao ?? '',
    l.seq ?? '',
    '',
    '',
    '',
  ]);
  escreverLinhas(ws, linhas);
  // Coluna Status (J), só quando há itens — igual ao original.
  for (let r = 2; r <= linhas.length + 1 && linhas.length > 0; r += 1) {
    ws.getCell(`J${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Pendente,Em andamento,Concluído,N/A"'],
    };
  }
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  dados: DadosLevantamento = carregarYaml<DadosLevantamento>(
    'levantamento.yaml',
  ),
): Workbook {
  const cliente = dados.cliente || dados.client_name || 'Cliente';
  const { achados } = resolverModulos(dados.modulos_contratados);
  const roteiro = linhasDoChecklist(dados.modulos_contratados);

  const wb = new Workbook();
  montarAbaModulos(wb, cliente, achados);
  montarAbaChecklist(wb, roteiro);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const dados = carregarYaml<DadosLevantamento>('levantamento.yaml');
  const cliente = dados.cliente || dados.client_name || 'Cliente';
  const wb = montarWorkbook(dados);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(OUT_DIR, `CheckList_Consultor_${slug(cliente)}.xlsx`);
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
