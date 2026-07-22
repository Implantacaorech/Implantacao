import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OUT_DIR, carregarYaml, slug } from './comum';
import {
  DocumentoDocx,
  No,
  adicionarLinha,
  celulasDaLinha,
  definirTextoDaCelula,
  definirTextoDoParagrafo,
  linhasDaTabela,
  textoDaCelula,
  textoDoParagrafo,
} from './docx-dom';
import { agruparPorArea, resolverModulos } from './catalogo';

/** Porte de `tools/gerar_levantamento.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Levantamento (Mapeamento de Processos) PREENCHENDO o modelo REAL da Rech
 * (`tools/templates/base_levantamento_modelo.docx`). O layout, as seções, as áreas, a
 * formatação e o espaçamento vêm do próprio modelo — só os campos dinâmicos são preenchidos.
 * Não reconstrói nada do zero. Porte de EQUIVALÊNCIA — prova em `gerar-levantamento.spec.ts`.
 */

export const CAMINHO_MODELO = join(
  process.cwd(),
  '..',
  'tools',
  'templates',
  'base_levantamento_modelo.docx',
);

export function modeloExiste(): boolean {
  return existsSync(CAMINHO_MODELO);
}

interface Usuario {
  nome?: string;
  email?: string;
  atribuicoes?: string;
}
interface ModuloPrevisto {
  modulo?: string;
  necessidade?: string;
  obs?: string;
}
interface DadosLevantamento {
  cliente?: string;
  data?: string;
  responsaveis?: string;
  identificacao?: {
    razao_social?: string;
    ramo?: string;
    produto?: string;
    fornecedor_atual?: string;
    localizacao?: string;
    observacoes_objetivos?: string;
  };
  modulos_contratados?: (string | number)[];
  conversoes?: {
    horas?: string | number;
    estimativas?: Record<string, string | number>;
  };
  usuarios?: Usuario[];
  total_usuarios?: string | number;
  modulos_previstos_antes?: ModuloPrevisto[];
  modulos_identificados?: ModuloPrevisto[];
  horas?: {
    cobradas?: string | number;
    bonificadas?: string | number;
    total?: string | number;
  };
}

/** Normaliza o nome de uma área para casar o título do modelo com o catálogo — `_norm_area()`:
 * tira "(rhu)", acentos e tudo que não é alfanumérico. */
export function normalizarArea(s: string | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\(rhu\)/g, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Acrescenta " horas" quando o valor é só número — `_h()`. O levantamento pede para
 * informar apenas os números, então o sufixo é acrescentado aqui. */
export function comHoras(v: string | number | null | undefined): string {
  const texto = (v === null || v === undefined ? '' : String(v)).trim();
  const semSeparador = texto.replace(/\./g, '').replace(/,/g, '');
  const soDigitos = semSeparador.length > 0 && /^\d+$/.test(semSeparador);
  return texto && soDigitos ? `${texto} horas` : texto;
}

/** Preenche as linhas a partir de `inicio`, reaproveitando as existentes e acrescentando o
 * que faltar — `_fill_table()`. */
function preencherTabela(tbl: No, dados: string[][], inicio = 1): void {
  dados.forEach((linha, i) => {
    const r = inicio + i;
    const linhas = linhasDaTabela(tbl);
    const tr = r < linhas.length ? linhas[r] : adicionarLinha(tbl);
    const celulas = celulasDaLinha(tr);
    linha.forEach((v, j) => {
      if (j < celulas.length) definirTextoDaCelula(celulas[j], v);
    });
  });
}

/** Rótulos das estimativas de conversão, na ordem em que aparecem no modelo. */
const ESTIMATIVAS: [string, string][] = [
  ['Imp. Cad. clientes e fornecedores – Estimativa:', 'clientes_fornecedores'],
  ['Imp. Cad. produtos – Estimativa:', 'produtos'],
  ['Imp. Mov. Financeiro doc. em aberto – Estimativa:', 'financeiro'],
  ['Imp. Notas Fiscais já emitidas – Estimativa:', 'notas_fiscais'],
  ['Importação de movimentos da Folha de Pagamento:', 'folha'],
];

/** Preenche o modelo e devolve o documento pronto para gravar. Separado de `gerar()` para o
 * teste inspecionar sem escrever em disco. */
export async function montarDocumento(
  d: DadosLevantamento = carregarYaml<DadosLevantamento>('levantamento.yaml'),
): Promise<Buffer> {
  if (!modeloExiste()) {
    throw new Error(
      "ERRO: modelo 'tools/templates/base_levantamento_modelo.docx' não encontrado.",
    );
  }

  const idf = d.identificacao ?? {};
  const { achados: contratados } = resolverModulos(d.modulos_contratados);
  const porArea = new Map<string, string>();
  for (const [area, mods] of contratados.length > 0
    ? agruparPorArea(contratados)
    : []) {
    porArea.set(
      normalizarArea(area),
      mods
        .map((m) => m.descricao)
        .filter((x): x is string => Boolean(x))
        .join('; '),
    );
  }
  const conv = d.conversoes ?? {};
  const estimativas = conv.estimativas ?? {};

  const doc = await DocumentoDocx.abrir(CAMINHO_MODELO);

  let areaAtual: string | null = null;
  for (const p of doc.paragrafos()) {
    // O modelo usa espaço não-quebrável em vários rótulos; sem normalizar, os `startsWith`
    // abaixo não casariam.
    const t = textoDoParagrafo(p)
      .replace(/\u00a0/g, ' ')
      .trim();
    if (!t) continue;

    if (t.startsWith('Mapeamento de processo')) {
      // O título traz "Mapeamento de processo – <Área>"; a área é o que vem depois do traço.
      const partes = t.split(/[–-]/);
      areaAtual = normalizarArea(partes[partes.length - 1]);
      continue;
    }

    if (t === '< Nome Cliente >') {
      definirTextoDoParagrafo(p, d.cliente ?? '');
    } else if (t.startsWith('Data:')) {
      definirTextoDoParagrafo(p, `Data: ${String(d.data ?? '')}`);
    } else if (t.startsWith('Responsáveis:')) {
      definirTextoDoParagrafo(
        p,
        `Responsáveis: ${String(d.responsaveis ?? '')}`,
      );
    } else if (t.startsWith('<Razão Social')) {
      definirTextoDoParagrafo(
        p,
        `Razão Social: ${idf.razao_social || d.cliente || ''}`,
      );
    } else if (t.startsWith('Ramo Atividade:')) {
      definirTextoDoParagrafo(p, `Ramo Atividade: ${idf.ramo ?? ''}`);
    } else if (t.startsWith('Produto:')) {
      definirTextoDoParagrafo(p, `Produto: ${idf.produto ?? ''}`);
    } else if (t.startsWith('Fornecedor Atual Software:')) {
      definirTextoDoParagrafo(
        p,
        `Fornecedor Atual Software: ${idf.fornecedor_atual ?? ''}`,
      );
    } else if (t.startsWith('<Localização')) {
      definirTextoDoParagrafo(
        p,
        `Localização / Filiais: ${idf.localizacao ?? ''}`,
      );
    } else if (t.startsWith('Observações / Objetivos:')) {
      definirTextoDoParagrafo(
        p,
        `Observações / Objetivos: ${idf.observacoes_objetivos ?? ''}`,
      );
    } else if (t.startsWith('<Quantidade usuários')) {
      const total = d.total_usuarios || (d.usuarios ?? []).length || '';
      definirTextoDoParagrafo(
        p,
        `Quantidade usuários e identificação: ${total ? `${total} usuários` : ''}`,
      );
    } else if (t.startsWith('CONVERSÕES')) {
      definirTextoDoParagrafo(
        p,
        `CONVERSÕES (${String(conv.horas ?? '')} horas)`,
      );
    } else {
      const rotulo = ESTIMATIVAS.find(([pref]) => t.startsWith(pref));
      if (rotulo) {
        definirTextoDoParagrafo(
          p,
          `${rotulo[0]} ${comHoras(estimativas[rotulo[1]])}`,
        );
      } else if (/^<x+\s*>$/.test(t) || t === 'XX') {
        // Marcador de conteúdo da área corrente: recebe os módulos daquela área.
        definirTextoDoParagrafo(p, porArea.get(areaAtual ?? '') ?? '');
      }
      // "<Colar aqui...>" e demais textos: mantidos como no modelo.
    }
  }

  for (const tbl of doc.tabelas()) {
    const linhas = linhasDaTabela(tbl);
    const primeira = linhas.length > 0 ? celulasDaLinha(linhas[0]) : [];
    const h0 = primeira.length > 0 ? textoDaCelula(primeira[0]).trim() : '';

    if (h0 === 'Nome') {
      preencherTabela(
        tbl,
        (d.usuarios ?? []).map((u) => [
          u.nome ?? '',
          u.email ?? '',
          u.atribuicoes ?? '',
        ]),
        1,
      );
    } else if (h0.startsWith('Módulos/Adicionais (A)')) {
      // Os contratados têm prioridade; só quando não há nenhum é que entram os módulos
      // previstos antes do fechamento, com Sim/Não em colunas separadas.
      const linhasA: string[][] =
        contratados.length > 0
          ? contratados.map((m) => [`${m.abrev} — ${m.descricao}`, 'X', '', ''])
          : (d.modulos_previstos_antes ?? []).map((m) => {
              const nec = (m.necessidade ?? '').trim().toLowerCase();
              return [
                m.modulo ?? '',
                nec === 'sim' ? 'X' : '',
                nec === 'não' || nec === 'nao' ? 'X' : '',
                m.obs ?? '',
              ];
            });
      preencherTabela(tbl, linhasA, 2);
    } else if (h0.startsWith('Módulos/Adicionais (B)')) {
      preencherTabela(
        tbl,
        (d.modulos_identificados ?? []).map((m) => [
          m.modulo ?? '',
          m.necessidade ?? '',
          m.obs ?? '',
        ]),
        2,
      );
    } else if (h0.startsWith('Quantidade de horas')) {
      const h = d.horas ?? {};
      preencherTabela(
        tbl,
        [[comHoras(h.cobradas), comHoras(h.bonificadas), comHoras(h.total)]],
        1,
      );
    }
  }

  return doc.gravar();
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const d = carregarYaml<DadosLevantamento>('levantamento.yaml');
  const buffer = await montarDocumento(d);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(OUT_DIR, `Levantamento_${slug(d.cliente)}.docx`);
  writeFileSync(caminho, buffer);
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
