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
}

/** Data de hoje em dd/mm/aaaa — a única que é mascarada, pelo mesmo motivo do .xlsx. */
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

function mascarar(valor: string): string {
  return valor
    .split(HOJE)
    .join('<HOJE>')
    .split(HOJE_EXTENSO)
    .join('<HOJE_EXTENSO>');
}

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

/** Concatena o texto das runs de um <w:p> — equivale a `Paragraph.text` do python-docx. */
function textoDoParagrafo(p: No): string {
  let texto = '';
  for (const run of filhosComTag(p, 'w:r')) {
    for (const t of filhosComTag(run, 'w:t')) {
      for (const no of filhosDe(t)) {
        // O parser devolve o texto como string ou, quando o conteúdo é numérico, como number.
        // Qualquer outro tipo aqui significa que a leitura do XML saiu do esperado.
        const bruto = no['#text'];
        if (typeof bruto === 'string') texto += bruto;
        else if (typeof bruto === 'number') texto += String(bruto);
      }
    }
  }
  return mascarar(texto);
}

/** Texto de uma célula: parágrafos unidos por "\n" — equivale a `_Cell.text`. */
function textoDaCelula(tc: No): string {
  return filhosComTag(tc, 'w:p').map(textoDoParagrafo).join('\n');
}

function extrairTabela(tbl: No): string[][] {
  return filhosComTag(tbl, 'w:tr').map((tr) =>
    filhosComTag(tr, 'w:tc').map(textoDaCelula),
  );
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

  return { tipo: 'docx', paragrafos, tabelas };
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
  return JSON.parse(readFileSync(caminho, 'utf8')) as SnapshotDocx;
}
