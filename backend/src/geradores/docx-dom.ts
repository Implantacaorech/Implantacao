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

/** Um parágrafo junto do array que o contém (o nó não guarda referência ao pai). */
export interface ParagrafoLocalizado {
  p: No;
  container: No[];
}

export function removerDoContainer(container: No[], no: No): void {
  const i = container.indexOf(no);
  if (i >= 0) container.splice(i, 1);
}

export function inserirDepois(container: No[], ref: No, novo: No): void {
  const i = container.indexOf(ref);
  container.splice(i >= 0 ? i + 1 : container.length, 0, novo);
}

export function clonar<T>(no: T): T {
  return structuredClone(no);
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
    removerDoContainer(filhosDe(this.corpo()), p);
  }

  /** Filhos diretos de `<w:body>`, na ordem — parágrafos E tabelas misturados. */
  filhosDoCorpo(): No[] {
    return filhosDe(this.corpo());
  }

  /** Todos os parágrafos na ordem do documento, INCLUINDO os de dentro de tabelas —
   * equivale a `iter_paragraphs_in_order()` do gerador Python. Cada item traz o array que
   * o contém, porque nesta árvore o nó não conhece o próprio pai e há operações
   * (remover, inserir depois) que precisam dele. */
  paragrafosEmOrdem(): ParagrafoLocalizado[] {
    const saida: ParagrafoLocalizado[] = [];
    for (const filho of filhosDe(this.corpo())) {
      const tag = nomeDaTag(filho);
      if (tag === 'w:p') {
        saida.push({ p: filho, container: filhosDe(this.corpo()) });
      } else if (tag === 'w:tbl') {
        for (const tr of filhosComTag(filho, 'w:tr')) {
          for (const tc of filhosComTag(tr, 'w:tc')) {
            const dentro = filhosDe(tc);
            for (const p of filhosComTag(tc, 'w:p')) {
              saida.push({ p, container: dentro });
            }
          }
        }
      }
    }
    return saida;
  }

  /** Cabeçalhos e rodapés, para as limpezas que o original também aplica neles. */
  async partesDeCabecalhoRodape(): Promise<{ nome: string; raiz: No[] }[]> {
    const nomes = Object.keys(this.zip.files).filter((n) =>
      /^word\/(header|footer)\d*\.xml$/.test(n),
    );
    const partes: { nome: string; raiz: No[] }[] = [];
    for (const nome of nomes) {
      const xml = await this.zip.files[nome].async('string');
      partes.push({ nome, raiz: analisador.parse(xml) as No[] });
    }
    return partes;
  }

  /** Regrava uma parte de cabeçalho/rodapé alterada. */
  regravarParte(nome: string, raiz: No[]): void {
    this.zip.file(nome, construtor.build(raiz));
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

/** Runs de um parágrafo. */
export function runsDoParagrafo(p: No): No[] {
  return filhosComTag(p, 'w:r');
}

/** Texto de uma run — expõe o helper interno para quem precisa medir posições. */
export function textoDaRunPublico(run: No): string {
  return textoDaRun(run);
}

/** Conteúdo textual de uma run, no formato do OOXML: tabulação é `<w:tab/>` e quebra de
 * linha é `<w:br/>`. É o que o setter de `Run.text` do python-docx faz. */
function nosDeTexto(texto: string): No[] {
  const saida: No[] = [];
  let acumulado = '';
  const despejar = () => {
    if (acumulado) {
      saida.push({
        'w:t': [{ '#text': acumulado }],
        ':@': { '@_xml:space': 'preserve' },
      });
      acumulado = '';
    }
  };
  for (const ch of texto) {
    if (ch === '\t') {
      despejar();
      saida.push({ 'w:tab': [] });
    } else if (ch === '\n' || ch === '\r') {
      despejar();
      saida.push({ 'w:br': [] });
    } else {
      acumulado += ch;
    }
  }
  despejar();
  return saida;
}

/** Escreve o texto de uma run preservando o `<w:rPr>` — setter de `Run.text`. */
export function definirTextoDaRun(run: No, texto: string): void {
  const filhos = filhosDe(run);
  const rPr = filhos.filter((c) => nomeDaTag(c) === 'w:rPr');
  filhos.length = 0;
  filhos.push(...rPr, ...nosDeTexto(texto));
}

/** Acrescenta quebra de linha e texto ao fim da run — `add_break()` + `add_text()`. */
export function acrescentarQuebraETexto(run: No, texto: string): void {
  const filhos = filhosDe(run);
  filhos.push({ 'w:br': [] }, ...nosDeTexto(texto));
}

/** Remove cor, realce e sombreamento da run — `strip_color()`. No template tokenizado esses
 * atributos marcam o que é PARA PREENCHER (vermelho/realce verde); depois de preenchido, a
 * marcação tem de sair, senão o documento entregue ao cliente sai pintado. */
export function limparCorDaRun(run: No): void {
  for (const rPr of filhosComTag(run, 'w:rPr')) {
    const filhos = filhosDe(rPr);
    const restantes = filhos.filter((c) => {
      const tag = nomeDaTag(c);
      return tag !== 'w:color' && tag !== 'w:highlight' && tag !== 'w:shd';
    });
    filhos.length = 0;
    filhos.push(...restantes);
  }
}

/** Remove realce sempre e cor só quando NÃO é preta/automática — `_clean_rpr()`. */
function limparRpr(rPr: No): void {
  const filhos = filhosDe(rPr);
  const restantes = filhos.filter((c) => {
    const tag = nomeDaTag(c);
    if (tag === 'w:highlight') return false;
    if (tag === 'w:color') {
      const val = (atributos(c)?.['@_w:val'] ?? '').toLowerCase();
      return val === '000000' || val === 'auto';
    }
    return true;
  });
  filhos.length = 0;
  filhos.push(...restantes);
}

/** Limpa os marcadores de preenchimento de um parágrafo — `_clean_paragraph_markers()`. */
export function limparMarcadoresDoParagrafo(p: No): void {
  for (const pPr of filhosComTag(p, 'w:pPr')) {
    for (const rPr of filhosComTag(pPr, 'w:rPr')) limparRpr(rPr);
  }
  for (const run of runsDoParagrafo(p)) {
    for (const rPr of filhosComTag(run, 'w:rPr')) limparRpr(rPr);
  }
}

/** Percorre todo `<w:p>` de uma árvore, em qualquer profundidade (para cabeçalho/rodapé). */
export function todosOsParagrafos(nos: No[]): No[] {
  const saida: No[] = [];
  const percorrer = (lista: No[]) => {
    for (const no of lista) {
      if (nomeDaTag(no) === 'w:p') saida.push(no);
      else percorrer(filhosDe(no));
    }
  };
  percorrer(nos);
  return saida;
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

/** Escreve o texto da célula mantendo só o 1º parágrafo — `set_cell_text()` do gerador do
 * Projeto (diferente do setter de `_Cell.text`: aqui o 1º parágrafo é REAPROVEITADO, com sua
 * formatação, e os demais são removidos). */
export function definirTextoDaCelulaMantendoEstilo(
  tc: No,
  texto: string,
): void {
  const paragrafos = filhosComTag(tc, 'w:p');
  if (paragrafos.length === 0) {
    filhosDe(tc).push({ 'w:p': [novaRun(texto)] });
    return;
  }
  definirTextoDoParagrafoRemovendoRuns(paragrafos[0], texto);
  const filhos = filhosDe(tc);
  for (const extra of paragrafos.slice(1)) removerDoContainer(filhos, extra);
}

/** Como `definirTextoDoParagrafo`, mas REMOVE as runs excedentes em vez de esvaziá-las, e
 * tira a cor da run que sobra — `set_paragraph_text()` do gerador do Projeto. */
export function definirTextoDoParagrafoRemovendoRuns(
  p: No,
  texto: string,
): void {
  const runs = runsDoParagrafo(p);
  if (runs.length === 0) {
    filhosDe(p).push(novaRun(texto));
  } else {
    definirTextoDaRun(runs[0], texto);
    const filhos = filhosDe(p);
    for (const extra of runs.slice(1)) removerDoContainer(filhos, extra);
  }
  const restantes = runsDoParagrafo(p);
  if (restantes.length > 0) limparCorDaRun(restantes[0]);
}

/** Força a grade completa nas tabelas e remove bordas de célula — `ensure_table_borders()`. */
export function garantirBordasDaTabela(tbl: No): void {
  const filhos = filhosDe(tbl);
  let tblPr = filhosComTag(tbl, 'w:tblPr')[0];
  if (!tblPr) {
    tblPr = { 'w:tblPr': [] };
    filhos.unshift(tblPr);
  }
  const dentroPr = filhosDe(tblPr);
  const semBordas = dentroPr.filter((c) => nomeDaTag(c) !== 'w:tblBorders');
  const lados = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'];
  const bordas: No = {
    'w:tblBorders': lados.map((lado) => ({
      [`w:${lado}`]: [],
      ':@': {
        '@_w:val': 'single',
        '@_w:sz': '4',
        '@_w:space': '0',
        '@_w:color': 'auto',
      },
    })),
  };
  dentroPr.length = 0;
  dentroPr.push(...semBordas, bordas);

  for (const tr of linhasDaTabela(tbl)) {
    for (const tc of celulasDaLinha(tr)) {
      for (const tcPr of filhosComTag(tc, 'w:tcPr')) {
        const dentro = filhosDe(tcPr);
        const restantes = dentro.filter((c) => nomeDaTag(c) !== 'w:tcBorders');
        dentro.length = 0;
        dentro.push(...restantes);
      }
    }
  }
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
