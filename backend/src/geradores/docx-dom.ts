import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import JSZip from 'jszip';

/** Camada mínima de leitura e ALTERAÇÃO de um .docx existente, em Node — o equivalente do
 * que os geradores Python fazem com o python-docx (§4.2/§4.7 dos Padrões da Rech).
 *
 * `docx-template.ts` resolve o caso simples (trocar o corpo inteiro preservando seção e
 * timbre). O Levantamento e o Projeto de Implantação precisam de mais: abrir o modelo
 * OFICIAL da Rech e alterar elementos NO LUGAR — reescrever o texto de um parágrafo
 * preservando o estilo, preencher tabelas existentes, remover parágrafos. Tudo o que não for
 * tocado tem de sair idêntico, porque é o layout aprovado que vai para o cliente.
 *
 * A fidelidade do ciclo ler→alterar→gravar foi verificada antes de qualquer porte: o
 * documento reserializado sem nenhuma alteração é lido pelo python-docx com exatamente o
 * mesmo conteúdo (corpo, tabelas, cabeçalhos e rodapés) do original.
 */

const OPCOES = {
  preserveOrder: true as const,
  ignoreAttributes: false as const,
  trimValues: false as const,
  parseTagValue: false as const,
  parseAttributeValue: false as const,
  suppressEmptyNode: true as const,
};

const analisador = new XMLParser(OPCOES);
const construtor = new XMLBuilder(OPCOES);

/** Nó do fast-xml-parser em modo preserveOrder: `{ "w:p": [ ...filhos ], ":@"?: atributos }`. */
export type No = Record<string, unknown>;

export function nomeDaTag(no: No): string | undefined {
  return Object.keys(no).find((k) => k !== ':@' && k !== '#text');
}

export function filhosDe(no: No): No[] {
  const tag = nomeDaTag(no);
  return tag ? ((no[tag] as No[] | undefined) ?? []) : [];
}

export function filhosComTag(no: No, tag: string): No[] {
  return filhosDe(no).filter((f) => nomeDaTag(f) === tag);
}

function atributos(no: No): Record<string, string> | undefined {
  return no[':@'] as Record<string, string> | undefined;
}

/** Um .docx aberto para alteração. */
export class DocumentoDocx {
  private constructor(
    private readonly zip: JSZip,
    private readonly raiz: No[],
  ) {}

  static async abrir(caminho: string): Promise<DocumentoDocx> {
    const zip = await JSZip.loadAsync(readFileSync(caminho));
    const arquivo = zip.file('word/document.xml');
    if (!arquivo) throw new Error(`${caminho}: sem word/document.xml`);
    const raiz = analisador.parse(await arquivo.async('string')) as No[];
    return new DocumentoDocx(zip, raiz);
  }

  private corpo(): No {
    const documento = this.raiz.find((n) => nomeDaTag(n) === 'w:document');
    if (!documento) throw new Error('.docx sem <w:document>');
    const corpo = filhosComTag(documento, 'w:body')[0];
    if (!corpo) throw new Error('.docx sem <w:body>');
    return corpo;
  }

  /** Parágrafos do corpo, na ordem — equivale a `Document.paragraphs` (só filhos DIRETOS de
   * `<w:body>`; os de dentro de tabela não entram). */
  paragrafos(): No[] {
    return filhosComTag(this.corpo(), 'w:p');
  }

  /** Tabelas do corpo, na ordem — equivale a `Document.tables`. */
  tabelas(): No[] {
    return filhosComTag(this.corpo(), 'w:tbl');
  }

  /** Remove um parágrafo do corpo. */
  removerParagrafo(p: No): void {
    const filhos = filhosDe(this.corpo());
    const i = filhos.indexOf(p);
    if (i >= 0) filhos.splice(i, 1);
  }

  async gravar(): Promise<Buffer> {
    const documento = this.raiz.find((n) => nomeDaTag(n) === 'w:document');
    if (!documento) throw new Error('.docx sem <w:document>');
    this.zip.file('word/document.xml', construtor.build(this.raiz));
    return this.zip.generateAsync({ type: 'nodebuffer' });
  }
}

// --- Parágrafos ------------------------------------------------------------------------

function textoDaRun(run: No): string {
  let texto = '';
  for (const filho of filhosDe(run)) {
    const tag = nomeDaTag(filho);
    if (tag === 'w:t') {
      for (const no of filhosDe(filho)) {
        const bruto = no['#text'];
        if (typeof bruto === 'string') texto += bruto;
        else if (typeof bruto === 'number') texto += String(bruto);
      }
    } else if (tag === 'w:tab') texto += '\t';
    else if (tag === 'w:br' || tag === 'w:cr') texto += '\n';
  }
  return texto;
}

/** Texto de um `<w:p>` — equivale a `Paragraph.text`. */
export function textoDoParagrafo(p: No): string {
  return filhosComTag(p, 'w:r').map(textoDaRun).join('');
}

/** Cria um `<w:r>` com o texto dado. `xml:space="preserve"` evita que o Word engula espaços
 * das pontas — o python-docx faz o mesmo ao atribuir texto a uma run. */
function novaRun(texto: string): No {
  return {
    'w:r': [
      {
        'w:t': [{ '#text': texto }],
        ':@': { '@_xml:space': 'preserve' },
      },
    ],
  };
}

/** Substitui o texto do parágrafo PRESERVANDO o estilo do 1º run — equivale a `_set_text()`
 * dos geradores Python: escreve no primeiro run e esvazia os demais. É isso que mantém a
 * fonte, o tamanho e a cor definidos no modelo oficial. */
export function definirTextoDoParagrafo(p: No, texto: string): void {
  const runs = filhosComTag(p, 'w:r');
  if (runs.length === 0) {
    filhosDe(p).push(novaRun(texto));
    return;
  }
  const [primeira, ...demais] = runs;

  // Reescreve o conteúdo do 1º run mantendo o <w:rPr> (a formatação).
  const conteudo = filhosDe(primeira);
  const rPr = conteudo.filter((c) => nomeDaTag(c) === 'w:rPr');
  conteudo.length = 0;
  conteudo.push(...rPr, {
    'w:t': [{ '#text': texto }],
    ':@': { '@_xml:space': 'preserve' },
  });

  for (const run of demais) {
    const filhos = filhosDe(run);
    const pr = filhos.filter((c) => nomeDaTag(c) === 'w:rPr');
    filhos.length = 0;
    filhos.push(...pr);
  }
}

// --- Tabelas ---------------------------------------------------------------------------

export function linhasDaTabela(tbl: No): No[] {
  return filhosComTag(tbl, 'w:tr');
}

export function celulasDaLinha(tr: No): No[] {
  return filhosComTag(tr, 'w:tc');
}

/** Texto de uma célula: parágrafos unidos por "\n" — equivale a `_Cell.text`. */
export function textoDaCelula(tc: No): string {
  return filhosComTag(tc, 'w:p').map(textoDoParagrafo).join('\n');
}

/** Escreve o texto da célula — equivale ao SETTER de `_Cell.text` do python-docx, que
 * descarta todo o conteúdo e deixa um único parágrafo com uma única run. O `<w:tcPr>`
 * (largura, sombreamento, mescla) é preservado, senão a célula perderia a formatação. */
export function definirTextoDaCelula(tc: No, texto: string): void {
  const filhos = filhosDe(tc);
  const tcPr = filhos.filter((c) => nomeDaTag(c) === 'w:tcPr');
  filhos.length = 0;
  filhos.push(...tcPr, { 'w:p': [novaRun(texto)] });
}

/** Quantas colunas a grade da tabela tem — `<w:tblGrid>`. */
function colunasDaGrade(tbl: No): No[] {
  const grade = filhosComTag(tbl, 'w:tblGrid')[0];
  return grade ? filhosComTag(grade, 'w:gridCol') : [];
}

/** Acrescenta uma linha ao fim da tabela — equivale a `Table.add_row()`: uma célula por
 * coluna da grade, cada uma com a largura da coluna e um parágrafo vazio. */
export function adicionarLinha(tbl: No): No {
  const larguras = colunasDaGrade(tbl).map(
    (col) => atributos(col)?.['@_w:w'] ?? '0',
  );
  const celulas: No[] = larguras.map((largura) => ({
    'w:tc': [
      {
        'w:tcPr': [
          { 'w:tcW': [], ':@': { '@_w:w': largura, '@_w:type': 'dxa' } },
        ],
      },
      { 'w:p': [] },
    ],
  }));
  const tr: No = { 'w:tr': celulas };
  filhosDe(tbl).push(tr);
  return tr;
}
