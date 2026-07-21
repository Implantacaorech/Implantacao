import { Workbook } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
  HEADER_FILL,
  HEADER_FONT,
  OUT_DIR,
  SUB_FONT,
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

/** Porte de `tools/gerar_kit_mudanca.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Kit de Gestão da Mudança (OCM) em .xlsx: Mapa de Stakeholders, Plano de Comunicação,
 * Prontidão (ADKAR), Plano de Treinamento por Papel e Indicadores de Adoção. Porte de
 * EQUIVALÊNCIA — prova em `gerar-kit-mudanca.spec.ts`. */

interface Stakeholder {
  nome?: string;
  papel?: string;
  influencia?: string;
  interesse?: string;
  postura?: string;
  estrategia?: string;
}
interface Comunicacao {
  momento?: string;
  publico?: string;
  canal?: string;
  mensagem?: string;
  responsavel?: string;
  frequencia?: string;
}
interface Prontidao {
  dimensoes?: string[];
  grupos?: string[];
}
interface Treinamento {
  papel?: string;
  modulos?: string[];
  cenarios?: string[];
  carga_horaria?: string;
}
interface IndicadorAdocao {
  indicador?: string;
  meta?: string;
}
interface DadosOcm {
  stakeholders?: Stakeholder[];
  comunicacao?: Comunicacao[];
  prontidao?: Prontidao;
  treinamento_papel?: Treinamento[];
  indicadores_adocao?: IndicadorAdocao[];
}
interface Cliente {
  nome?: string;
  codigo_sicla?: string;
  usuario_lider?: string;
  data_virada_prevista?: string;
}
interface DadosCliente {
  cliente?: Cliente;
}

function montarCapa(wb: Workbook, cliente: Cliente): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [24, 60]);
  blocoTitulo(
    ws,
    'Kit de Gestão da Mudança (OCM)',
    `${cliente.nome ?? ''} · gerado em ${hoje()}`,
    2,
  );
  // A 5ª entrada é uma linha em branco proposital, separando os dados do cliente do
  // propósito/modelo — por isso o rótulo vazio não recebe estilo de cabeçalho.
  const info: [string, string][] = [
    ['Cliente', cliente.nome ?? ''],
    ['Código SICLA', cliente.codigo_sicla ?? ''],
    ['Usuário líder', cliente.usuario_lider ?? ''],
    ['Virada prevista', cliente.data_virada_prevista ?? ''],
    ['', ''],
    [
      'Propósito',
      'Garantir adoção plena: tratar pessoas, comunicação e capacitação, não só o sistema.',
    ],
    [
      'Modelo',
      'ADKAR — Consciência, Desejo, Conhecimento, Habilidade, Reforço.',
    ],
  ];
  info.forEach(([rotulo, valor], i) => {
    const r = 4 + i;
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
  });
}

function montarStakeholders(wb: Workbook, dados: DadosOcm): void {
  const ws = wb.addWorksheet('Mapa de Stakeholders');
  linhaCabecalho(ws, [
    'Nome/Cargo',
    'Papel',
    'Influência',
    'Interesse',
    'Postura',
    'Estratégia de engajamento',
  ]);
  definirLarguras(ws, [24, 24, 12, 12, 16, 46]);
  escreverLinhas(
    ws,
    (dados.stakeholders ?? []).map((s) => [
      s.nome ?? '',
      s.papel ?? '',
      s.influencia ?? '',
      s.interesse ?? '',
      s.postura ?? '',
      s.estrategia ?? '',
    ]),
  );
}

function montarComunicacao(wb: Workbook, dados: DadosOcm): void {
  const ws = wb.addWorksheet('Plano de Comunicação');
  linhaCabecalho(ws, [
    'Momento',
    'Público',
    'Canal',
    'Mensagem-chave',
    'Responsável',
    'Frequência',
  ]);
  definirLarguras(ws, [20, 24, 18, 44, 22, 16]);
  escreverLinhas(
    ws,
    (dados.comunicacao ?? []).map((c) => [
      c.momento ?? '',
      c.publico ?? '',
      c.canal ?? '',
      c.mensagem ?? '',
      c.responsavel ?? '',
      c.frequencia ?? '',
    ]),
  );
}

function montarProntidao(wb: Workbook, dados: DadosOcm): void {
  const ws = wb.addWorksheet('Prontidão (ADKAR)');
  const dims = dados.prontidao?.dimensoes ?? [];
  const grupos = dados.prontidao?.grupos ?? [];
  linhaCabecalho(ws, ['Grupo / Área', ...dims, 'Ações de reforço']);
  definirLarguras(ws, [22, ...dims.map(() => 20), 34]);
  const linhas: ValorCelula[][] = grupos.map((g) => [
    g,
    ...dims.map(() => ''),
    '',
  ]);
  escreverLinhas(ws, linhas);
  const nota = ws.getCell(grupos.length + 3, 1);
  nota.value =
    'Preencher cada dimensão com nota de 1 (baixo) a 5 (alto) por grupo. ' +
    'Notas baixas viram ações de reforço.';
  nota.font = SUB_FONT;
  nota.alignment = WRAP;
}

function montarTreinamento(wb: Workbook, dados: DadosOcm): void {
  const ws = wb.addWorksheet('Treinamento por Papel');
  linhaCabecalho(ws, [
    'Papel',
    'Módulos',
    'Cenários (não telas)',
    'Carga horária',
    'Status',
  ]);
  definirLarguras(ws, [22, 26, 44, 14, 16]);
  escreverLinhas(
    ws,
    (dados.treinamento_papel ?? []).map((t) => [
      t.papel ?? '',
      (t.modulos ?? []).join(', '),
      (t.cenarios ?? []).map((c) => `• ${c}`).join('\n'),
      t.carga_horaria ?? '',
      'A treinar',
    ]),
  );
}

function montarIndicadores(wb: Workbook, dados: DadosOcm): void {
  const ws = wb.addWorksheet('Indicadores de Adoção');
  linhaCabecalho(ws, ['Indicador', 'Meta', 'Como medir', 'Resultado']);
  definirLarguras(ws, [40, 26, 36, 18]);
  escreverLinhas(
    ws,
    (dados.indicadores_adocao ?? []).map((i) => [
      i.indicador ?? '',
      i.meta ?? '',
      '',
      '',
    ]),
  );
}

/** Monta o workbook. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  ocm: DadosOcm = carregarYaml<DadosOcm>('gestao_mudanca.yaml'),
): Workbook {
  const wb = new Workbook();
  montarCapa(wb, cliente.cliente ?? {});
  montarStakeholders(wb, ocm);
  montarComunicacao(wb, ocm);
  montarProntidao(wb, ocm);
  montarTreinamento(wb, ocm);
  montarIndicadores(wb, ocm);
  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Kit_Gestao_Mudanca_${slug(cliente.cliente?.nome)}.xlsx`,
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
