import { XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';

/** Prova de EQUIVALÊNCIA do porte dos geradores .docx (§4.7 dos Padrões da Rech).
 *
 * Extrai de um .docx o MESMO contrato observável que `tools/caracterizacao.py` extrai com o
 * python-docx: os parágrafos do corpo, na ordem, e o texto de cada célula de cada tabela.
 * Não se compara byte a byte — .docx é ZIP com timestamp embutido.
 *
 * As equivalências com o python-docx que este extrator precisa respeitar:
 *   `Document.paragraphs`  -> só os <w:p> filhos DIRETOS de <w:body> (os de dentro de tabela
 *                             não entram na lista, mesmo sendo parágrafos)
 *   `Paragraph.text`       -> concatenação dos <w:t> das runs, sem separador
 *   `Document.tables`      -> só os <w:tbl> filhos DIRETOS de <w:body>
 *   `_Cell.text`           -> parágrafos da célula unidos por "\n"
 */

export interface SnapshotDocx {
  tipo: string;
  paragrafos: string[];
  tabelas: string[][][];
  /** Parágrafos de cada word/headerN.xml, por nome de parte. */
  cabecalhos: Record<string, string[]>;
  /** Parágrafos de cada word/footerN.xml, por nome de parte. */
  rodapes: Record<string, string[]>;
}

/** Data de hoje em dd/mm/aaaa. */
function dataDeHoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const HOJE = dataDeHoje();

// O Cronograma fecha com "Novo Hamburgo, 21 de julho de 2026." — a data de hoje POR EXTENSO,
// que a máscara dd/mm/aaaa não pega. O harness Python mascara as duas formas; aqui também.
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function dataDeHojePorExtenso(): string {
  const d = new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

const HOJE_EXTENSO = dataDeHojePorExtenso();

/** Troca a data de hoje pelo marcador — nas duas formas.
 *
 * A troca é CEGA (qualquer ocorrência), e por isso é aplicada aos DOIS lados da comparação:
 * ao documento gerado agora e ao snapshot carregado (ver `carregarSnapshotDocx`). Aplicar só
 * de um lado foi o defeito que quebrou a suíte sozinha em 07/08/2026: o snapshot do Projeto
 * tem a data de negócio fixa "07/08/2026" vinda da fixture; naquele dia ela virou `<HOJE>`
 * no lado gerado e continuou literal no esperado. Seria assim em todo dia que batesse com
 * uma data das fixtures (04/05, 22/05, 28/05, 01/06, 30/06, 01/07, 07/08...).
 *
 * Normalizar os dois lados do mesmo jeito faz a coincidência se cancelar. O `.xlsx`
 * (`comparacao.ts`) resolveu o mesmo problema ancorando no rótulo "gerado em"; aqui não dá,
 * porque em `gerar_aceite_uat` a data de geração ocupa a célula inteira, sem rótulo nenhum. */
function mascarar(valor: string): string {
  return valor
    .split(HOJE)
    .join('<HOJE>')
    .split(HOJE_EXTENSO)
    .join('<HOJE_EXTENSO>');
}

/** Exposto só para o spec provar a simetria/idempotência sem depender do calendário. */
export const mascararParaTeste = mascarar;

// preserveOrder mantém a ordem entre <w:p> e <w:tbl> dentro do corpo, que faz parte do
// contrato. Sem ele, o parser agruparia por nome de tag e a ordem se perderia.
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
});

/** Nó do fast-xml-parser em modo preserveOrder: `{ "w:p": [ ...filhos ], ":@"?: atributos }`.
 * Os filhos ficam no ARRAY sob a própria tag — não como chaves do nó. */
type No = Record<string, unknown>;

/** Nome da tag de um nó (a única chave que não é ':@' nem '#text'). */
function nomeDaTag(no: No): string | undefined {
  return Object.keys(no).find((k) => k !== ':@' && k !== '#text');
}

/** Filhos diretos do nó. */
function filhosDe(no: No): No[] {
  const tag = nomeDaTag(no);
  return tag ? ((no[tag] as No[] | undefined) ?? []) : [];
}

/** Filhos diretos com a tag pedida. */
function filhosComTag(no: No, tag: string): No[] {
  return filhosDe(no).filter((f) => nomeDaTag(f) === tag);
}

/** Concatena o texto das runs de um <w:p> — equivale a `Paragraph.text` do python-docx.
 *
 * Nem todo caractere vira `<w:t>`: no OOXML a tabulação é o elemento `<w:tab/>` e a quebra
 * de linha é `<w:br/>`/`<w:cr/>`. O `CT_R.text` do python-docx traduz os três, e é por isso
 * que a linha de assinaturas do Termo aparece como "Assinatura Rech\t\t\tAssinatura Cliente"
 * no snapshot. Ler só `<w:t>` faria as tabulações sumirem do contrato. */
function textoDoParagrafo(p: No): string {
  let texto = '';
  for (const run of filhosComTag(p, 'w:r')) {
    for (const filho of filhosDe(run)) {
      const tag = nomeDaTag(filho);
      if (tag === 'w:t') {
        for (const no of filhosDe(filho)) {
          // O parser devolve o texto como string ou, quando é numérico, como number.
          const bruto = no['#text'];
          if (typeof bruto === 'string') texto += bruto;
          else if (typeof bruto === 'number') texto += String(bruto);
        }
      } else if (tag === 'w:tab') {
        texto += '\t';
      } else if (tag === 'w:br' || tag === 'w:cr') {
        texto += '\n';
      }
    }
  }
  return mascarar(texto);
}

/** Texto de uma célula: parágrafos unidos por "\n" — equivale a `_Cell.text`. */
function textoDaCelula(tc: No): string {
  return filhosComTag(tc, 'w:p').map(textoDoParagrafo).join('\n');
}

/** Quantas colunas da grade esta célula ocupa (`<w:gridSpan w:val="n"/>`). */
function colunasOcupadas(tc: No): number {
  for (const tcPr of filhosComTag(tc, 'w:tcPr')) {
    for (const span of filhosComTag(tcPr, 'w:gridSpan')) {
      const atributos = span[':@'] as Record<string, string> | undefined;
      const valor = Number(atributos?.['@_w:val']);
      if (Number.isFinite(valor) && valor > 0) return valor;
    }
  }
  return 1;
}

/** Tipo de mescla VERTICAL da célula: `<w:vMerge w:val="restart"/>` abre a mescla e
 * `<w:vMerge/>` (sem valor) continua a de cima. */
function tipoDeMesclaVertical(tc: No): 'inicio' | 'continua' | null {
  for (const tcPr of filhosComTag(tc, 'w:tcPr')) {
    for (const vm of filhosComTag(tcPr, 'w:vMerge')) {
      const atributos = vm[':@'] as Record<string, string> | undefined;
      return atributos?.['@_w:val'] === 'restart' ? 'inicio' : 'continua';
    }
  }
  return null;
}

/** Reproduz a grade de células como o python-docx a enxerga.
 *
 * Duas regras dele que precisam ser espelhadas, senão a comparação acusa falsa divergência:
 *   `gridSpan` (mescla horizontal) — a célula é REPETIDA em cada coluna que ocupa, então toda
 *     linha acaba com o mesmo número de posições;
 *   `vMerge`   (mescla vertical) — a célula de continuação devolve o texto da célula que
 *     ABRIU a mescla, não vazio. É o caso das colunas "Planejamento"/"Execução" do
 *     cronograma dentro do Projeto de Implantação. */
function extrairTabela(tbl: No): string[][] {
  const textoAcimaPorColuna: string[] = [];
  return filhosComTag(tbl, 'w:tr').map((tr) => {
    const linha: string[] = [];
    let coluna = 0;
    for (const tc of filhosComTag(tr, 'w:tc')) {
      const largura = colunasOcupadas(tc);
      const mescla = tipoDeMesclaVertical(tc);
      const texto =
        mescla === 'continua'
          ? (textoAcimaPorColuna[coluna] ?? '')
          : textoDaCelula(tc);
      if (mescla !== 'continua') {
        for (let k = 0; k < largura; k += 1)
          textoAcimaPorColuna[coluna + k] = texto;
      }
      for (let k = 0; k < largura; k += 1) linha.push(texto);
      coluna += largura;
    }
    return linha;
  });
}

/** Parágrafos de cada parte word/<prefixo>N.xml, por nome de parte.
 *
 * Cabeçalho e rodapé são o TIMBRE OFICIAL da Rech — são a razão de os geradores carregarem
 * `tools/templates/base_*.docx`. Sem eles no contrato, um porte que perdesse o timbre passaria
 * no teste, que é justamente o erro que mais importa evitar aqui. */
async function textoDasPartes(
  zip: JSZip,
  prefixo: string,
): Promise<Record<string, string[]>> {
  const padrao = new RegExp(`^word/${prefixo}\\d*\\.xml$`);
  const nomes = Object.keys(zip.files)
    .filter((n) => padrao.test(n))
    .sort();
  const partes: Record<string, string[]> = {};
  for (const nome of nomes) {
    const xml = await zip.files[nome].async('string');
    const raiz = parser.parse(xml) as No[];
    const paragrafos: string[] = [];
    const percorrer = (nos: No[]): void => {
      for (const no of nos) {
        if (nomeDaTag(no) === 'w:p') paragrafos.push(textoDoParagrafo(no));
        else percorrer(filhosDe(no));
      }
    };
    percorrer(raiz);
    partes[nome] = paragrafos;
  }
  return partes;
}

/** Extrai o conteúdo observável de um .docx já em memória. */
export async function extrairDocx(buffer: Buffer): Promise<SnapshotDocx> {
  const zip = await JSZip.loadAsync(buffer);
  const arquivo = zip.file('word/document.xml');
  if (!arquivo) throw new Error('.docx sem word/document.xml');
  const xml = await arquivo.async('string');

  const raiz = parser.parse(xml) as No[];
  const documento = raiz.find((n) => nomeDaTag(n) === 'w:document');
  if (!documento) throw new Error('.docx sem <w:document>');
  const corpo = filhosComTag(documento, 'w:body')[0];
  if (!corpo) throw new Error('.docx sem <w:body>');

  const paragrafos: string[] = [];
  const tabelas: string[][][] = [];
  for (const no of filhosDe(corpo)) {
    const tag = nomeDaTag(no);
    if (tag === 'w:p') paragrafos.push(textoDoParagrafo(no));
    else if (tag === 'w:tbl') tabelas.push(extrairTabela(no));
  }

  return {
    tipo: 'docx',
    paragrafos,
    tabelas,
    cabecalhos: await textoDasPartes(zip, 'header'),
    rodapes: await textoDasPartes(zip, 'footer'),
  };
}

/** Carrega o snapshot dourado gerado a partir do gerador Python original. */
export function carregarSnapshotDocx(nomeModuloPython: string): SnapshotDocx {
  const caminho = join(
    process.cwd(),
    '..',
    'tools',
    'caracterizacao',
    `${nomeModuloPython}.json`,
  );
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as SnapshotDocx;
  // O MESMO `mascarar` do lado gerado. O snapshot já vem com `<HOJE>` onde o harness Python
  // mascarou na captura, mas guarda LITERAIS as datas de negócio das fixtures — e uma delas
  // pode calhar de ser hoje. Normalizar aqui também faz a coincidência se cancelar em vez de
  // virar falha (ver `mascarar`).
  const porMapa = (m: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.map(mascarar)]));
  return {
    paragrafos: bruto.paragrafos.map(mascarar),
    tabelas: bruto.tabelas.map((t) => t.map((l) => l.map(mascarar))),
    cabecalhos: porMapa(bruto.cabecalhos),
    rodapes: porMapa(bruto.rodapes),
  };
}
