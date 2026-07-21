import { Workbook, Worksheet } from 'exceljs';
import { join } from 'path';
import { mkdirSync } from 'fs';
import {
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

/** Porte de `tools/gerar_raid.py` para Node/TypeScript (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o RAID (.xlsx) — Riscos, Premissas (Assumptions), Issues, Decisões e Dependências
 * de um projeto de implantação. É porte de EQUIVALÊNCIA: reproduz o conteúdo do original,
 * sem melhorias (§4.7 passo 5). A prova está em `gerar-raid.spec.ts`, que compara a saída
 * com o snapshot de caracterização gerado a partir do Python (`tools/caracterizacao/`). */

interface Risco {
  descricao?: string;
  impacto?: string;
  probabilidade?: string;
  mitigacao?: string;
  responsavel?: string;
}
interface Premissa {
  descricao?: string;
  validada?: string;
}
interface Issue {
  descricao?: string;
  severidade?: string;
  acao?: string;
  responsavel?: string;
  status?: string;
}
interface Decisao {
  descricao?: string;
  data?: string;
  por?: string;
}
interface Dependencia {
  descricao?: string;
  de_quem?: string;
  prazo?: string;
  status?: string;
}
interface DadosRaid {
  riscos?: Risco[];
  premissas?: Premissa[];
  issues?: Issue[];
  decisoes?: Decisao[];
  dependencias?: Dependencia[];
}
interface DadosCliente {
  cliente?: { nome?: string };
}

/** Numera os IDs como o original: prefixo + índice com 2 dígitos (R-01, A-01, DP-01…). */
function id(prefixo: string, i: number): string {
  return `${prefixo}-${String(i).padStart(2, '0')}`;
}

function aba(
  wb: Workbook,
  nome: string,
  colunas: string[],
  larguras: number[],
  linhas: string[][],
  listas?: Record<string, string[]>,
): Worksheet {
  const ws = wb.addWorksheet(nome);
  linhaCabecalho(ws, colunas);
  definirLarguras(ws, larguras);
  escreverLinhas(ws, linhas);
  // Validação por lista, igual ao original: da linha 2 até nº de linhas + 50.
  const n = Math.max(linhas.length, 1);
  for (const [coluna, opcoes] of Object.entries(listas ?? {})) {
    for (let r = 2; r <= n + 50; r += 1) {
      ws.getCell(`${coluna}${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${opcoes.join(',')}"`],
      };
    }
  }
  return ws;
}

function montarCapa(wb: Workbook, nomeCliente: string): void {
  const ws = wb.addWorksheet('Capa');
  definirLarguras(ws, [26, 60]);
  blocoTitulo(
    ws,
    'RAID — Riscos, Premissas, Issues e Decisões',
    `${nomeCliente} · gerado em ${hoje()}`,
    2,
  );
  const legenda: [string, string][] = [
    ['R', 'Riscos — eventos futuros que podem impactar o projeto'],
    ['A', 'Premissas (Assumptions) — o que assumimos como verdade'],
    ['I', 'Issues — problemas que já ocorreram e precisam de ação'],
    [
      'D',
      'Decisões e Dependências — o que foi decidido / o que depende de terceiros',
    ],
  ];
  legenda.forEach(([chave, texto], i) => {
    const linha = 4 + i;
    const a = ws.getCell(linha, 1);
    a.value = chave;
    a.font = HEADER_FONT;
    a.fill = HEADER_FILL;
    a.alignment = CENTER;
    const b = ws.getCell(linha, 2);
    b.value = texto;
    b.alignment = WRAP;
  });
}

/** Monta o workbook do RAID. Separado de `gerar()` para o teste inspecionar sem gravar. */
export function montarWorkbook(
  cliente: DadosCliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml'),
  raid: DadosRaid = carregarYaml<DadosRaid>('raid.yaml'),
): Workbook {
  const wb = new Workbook();
  const nomeCliente = cliente.cliente?.nome ?? '';
  montarCapa(wb, nomeCliente);

  aba(
    wb,
    'Riscos',
    [
      'ID',
      'Descrição',
      'Impacto',
      'Probabilidade',
      'Mitigação',
      'Responsável',
      'Status',
    ],
    [8, 46, 12, 14, 44, 18, 14],
    (raid.riscos ?? []).map((r, i) => [
      id('R', i + 1),
      r.descricao ?? '',
      r.impacto ?? '',
      r.probabilidade ?? '',
      r.mitigacao ?? '',
      r.responsavel ?? '',
      'Aberto',
    ]),
    {
      C: ['Alto', 'Médio', 'Baixo'],
      D: ['Alta', 'Média', 'Baixa'],
      G: ['Aberto', 'Mitigado', 'Fechado'],
    },
  );

  aba(
    wb,
    'Premissas',
    ['ID', 'Descrição', 'Validada?', 'Observação'],
    [8, 56, 12, 36],
    (raid.premissas ?? []).map((p, i) => [
      id('A', i + 1),
      p.descricao ?? '',
      p.validada ?? '',
      '',
    ]),
    { C: ['Sim', 'Não', 'Parcial'] },
  );

  aba(
    wb,
    'Issues',
    ['ID', 'Descrição', 'Severidade', 'Ação', 'Responsável', 'Status'],
    [8, 46, 14, 40, 18, 14],
    (raid.issues ?? []).map((s, i) => [
      id('I', i + 1),
      s.descricao ?? '',
      s.severidade ?? '',
      s.acao ?? '',
      s.responsavel ?? '',
      s.status ?? 'Aberto',
    ]),
    {
      C: ['Crítica', 'Alta', 'Média', 'Baixa'],
      F: ['Aberto', 'Em ação', 'Resolvido'],
    },
  );

  aba(
    wb,
    'Decisões',
    ['ID', 'Descrição', 'Data', 'Decidido por'],
    [8, 56, 14, 24],
    (raid.decisoes ?? []).map((d, i) => [
      id('D', i + 1),
      d.descricao ?? '',
      d.data ?? '',
      d.por ?? '',
    ]),
  );

  aba(
    wb,
    'Dependências',
    ['ID', 'Descrição', 'De quem', 'Prazo', 'Status'],
    [8, 50, 24, 14, 16],
    (raid.dependencias ?? []).map((dp, i) => [
      id('DP', i + 1),
      dp.descricao ?? '',
      dp.de_quem ?? '',
      dp.prazo ?? '',
      dp.status ?? 'Em andamento',
    ]),
    { E: ['Não iniciado', 'Em andamento', 'Concluído', 'Bloqueado'] },
  );

  return wb;
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const cliente = carregarYaml<DadosCliente>('exemplo_cliente.yaml');
  const wb = montarWorkbook(cliente);
  mkdirSync(OUT_DIR, { recursive: true });
  const nome = `RAID_${slug(cliente.cliente?.nome)}.xlsx`;
  const caminho = join(OUT_DIR, nome);
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
