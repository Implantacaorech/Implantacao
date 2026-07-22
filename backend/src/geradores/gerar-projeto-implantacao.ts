import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OUT_DIR, carregarYaml, slug } from './comum';
import {
  DocumentoDocx,
  No,
  ParagrafoLocalizado,
  acrescentarQuebraETexto,
  celulasDaLinha,
  clonar,
  definirTextoDaCelulaMantendoEstilo,
  definirTextoDaRun,
  definirTextoDoParagrafoRemovendoRuns,
  filhosDe,
  garantirBordasDaTabela,
  inserirDepois,
  limparCorDaRun,
  limparMarcadoresDoParagrafo,
  linhasDaTabela,
  nomeDaTag,
  removerDoContainer,
  runsDoParagrafo,
  textoDaCelula,
  textoDaRunPublico,
  textoDoParagrafo,
  todosOsParagrafos,
} from './docx-dom';
import {
  AREAS,
  CAMPOS_EQUIPE,
  GRUPOS,
  SECAO_APOS_ROTINAS,
  SUBAREAS,
  TOKENS_BLOCO,
} from './schema-projeto';
import { textoDe } from '../common/utils/texto.util';

/** Porte de `tools/gerar_projeto_implantacao.py` para Node/TS (§4.2/§4.7 dos Padrões da Rech).
 *
 * Gera o Projeto de Implantação do SIGER® (.docx) — documento OBRIGATÓRIO — a partir do
 * template TOKENIZADO da Rech (`tools/templates/base_projeto_tokenizado.docx`, com
 * `{{tokens}}`). A engine é a mesma do gerador interno (GeradorProjetoSIGER/docgen.py), na
 * mesma ordem:
 *
 *   1) remove as áreas (Detalhamento das Rotinas) não incluídas;
 *   2) preenche os tokens (campos "bloco" -> cada linha vira um bullet);
 *   3) reconstrói a Tabela de Usuários;
 *   4) preenche a Equipe (opcional);
 *   5) limpa os marcadores do modelo (vermelho/realce verde);
 *   6) corrige o typo "Da de Início" -> "Data de Início";
 *   7) força a grade completa das tabelas.
 *
 * Porte de EQUIVALÊNCIA — prova em `gerar-projeto-implantacao.spec.ts`. */

export const CAMINHO_TEMPLATE = join(
  process.cwd(),
  '..',
  'tools',
  'templates',
  'base_projeto_tokenizado.docx',
);

export function templateExiste(): boolean {
  return existsSync(CAMINHO_TEMPLATE);
}

const TOKEN_RE = /\{\{[a-z0-9_]+\}\}/g;
const CORRECOES: [string, string][] = [
  ['Da de Início do Uso oficial', 'Data de Início do Uso oficial'],
];

interface UsuarioProjeto {
  nome?: string;
  email?: string;
  area?: string;
  assina?: string;
}
interface DadosProjetoYaml {
  client_name?: string;
  usuarios?: UsuarioProjeto[];
  equipe?: Record<string, string>;
  areas_incluidas?: string[];
  [chave: string]: unknown;
}

export interface DadosProjeto {
  campos: Record<string, string>;
  usuarios: UsuarioProjeto[];
  equipe: Record<string, string>;
  areasIncluidas: string[];
}

/** Normaliza texto para comparar cabeçalhos — `_common.norm_doc()`: sem acento, minúsculo,
 * espaços colapsados e sem pontuação nas pontas. */
export function normalizarDoc(s: string | undefined | null): string {
  const semAcento = (s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return semAcento.replace(/^[ .:-]+|[ .:-]+$/g, '');
}

/** Monta os dados a partir do YAML — `build_data()`. Listas viram texto de várias linhas;
 * sem `areas_incluidas`, entram as áreas que têm algum subcampo preenchido. */
export function montarDados(y: DadosProjetoYaml): DadosProjeto {
  const especiais = new Set(['usuarios', 'equipe', 'areas_incluidas']);
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(y)) {
    if (especiais.has(k)) continue;
    // Cada item da lista vira uma linha (e, no documento, um bullet).
    campos[k] = Array.isArray(v)
      ? (v as unknown[]).map(textoDe).join('\n')
      : textoDe(v);
  }
  const areasIncluidas =
    y.areas_incluidas ??
    AREAS.filter((a) =>
      a.subfields.some((sf) => (campos[`${a.id}_${sf}`] ?? '').trim()),
    ).map((a) => a.id);
  return {
    campos,
    usuarios: y.usuarios ?? [],
    equipe: y.equipe ?? {},
    areasIncluidas,
  };
}

// --- 1) remoção de áreas não incluídas ---------------------------------------------------

function removerAreasNaoIncluidas(
  doc: DocumentoDocx,
  incluidas: string[],
): void {
  const filhos = doc.filhosDoCorpo();
  // Texto normalizado de cada filho do corpo; tabela não tem título, então entra como null.
  const textos = filhos.map((el) =>
    nomeDaTag(el) === 'w:p' ? normalizarDoc(textoDoParagrafo(el)) : null,
  );
  const fronteiras = new Set(
    [...GRUPOS, ...SUBAREAS, SECAO_APOS_ROTINAS].map(normalizarDoc),
  );
  const indiceDe = (alvo: string) => textos.indexOf(alvo);

  const remover: No[] = [];
  for (const area of AREAS) {
    if (incluidas.includes(area.id)) continue;
    const inicio = indiceDe(normalizarDoc(area.subarea));
    if (inicio === -1) continue;
    // A área vai do seu título até a próxima fronteira (outro grupo, outra subárea ou a
    // seção seguinte ao Detalhamento das Rotinas).
    let fim = textos.length;
    for (let j = inicio + 1; j < textos.length; j += 1) {
      const texto = textos[j];
      if (texto !== null && fronteiras.has(texto)) {
        fim = j;
        break;
      }
    }
    for (let k = inicio; k < fim; k += 1) remover.push(filhos[k]);
  }
  // Quando NENHUMA área do grupo entrou, o título do grupo também sai.
  for (const grupo of GRUPOS) {
    const doGrupo = AREAS.filter((a) => a.grupo === grupo);
    if (doGrupo.length > 0 && doGrupo.every((a) => !incluidas.includes(a.id))) {
      const i = indiceDe(normalizarDoc(grupo));
      if (i !== -1) remover.push(filhos[i]);
    }
  }

  const vistos = new Set<No>();
  for (const el of remover) {
    if (vistos.has(el)) continue;
    vistos.add(el);
    removerDoContainer(filhos, el);
  }
}

// --- 2) tokens ---------------------------------------------------------------------------

/** Substitui o trecho [inicio, fim) do texto do parágrafo, distribuído entre as runs —
 * `replace_span_in_runs()`. Devolve a run que recebeu o texto novo. */
function substituirTrechoNasRuns(
  runs: No[],
  inicio: number,
  fim: number,
  novoTexto: string,
  limparCor = false,
): No | null {
  let pos = 0;
  let colocou = false;
  let runColocada: No | null = null;
  for (const r of runs) {
    const txt = textoDaRunPublico(r);
    const rs = pos;
    const re = pos + txt.length;
    pos = re;
    if (re <= inicio || rs >= fim) continue;
    const esquerda = rs < inicio ? txt.slice(0, inicio - rs) : '';
    const direita = re > fim ? txt.slice(fim - rs) : '';
    if (!colocou) {
      definirTextoDaRun(r, esquerda + novoTexto + direita);
      colocou = true;
      runColocada = r;
    } else {
      definirTextoDaRun(r, direita);
    }
  }
  if (!colocou && runs.length > 0) {
    const ultima = runs[runs.length - 1];
    definirTextoDaRun(ultima, textoDaRunPublico(ultima) + novoTexto);
    runColocada = ultima;
  }
  if (limparCor && runColocada) limparCorDaRun(runColocada);
  return runColocada;
}

/** Token de BLOCO: ocupa o parágrafo inteiro e cada linha do valor vira um parágrafo novo,
 * clonado do original para herdar o estilo de bullet — `fill_block_token()`. */
function preencherTokenBloco(
  paragrafos: ParagrafoLocalizado[],
  nome: string,
  valor: string,
): void {
  const token = `{{${nome}}}`;
  const alvo = paragrafos.find(({ p }) => textoDoParagrafo(p).includes(token));
  if (!alvo) return;

  const linhas = (valor || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (linhas.length === 0) {
    // Sem conteúdo, o parágrafo do token sai do documento — não fica um bullet vazio.
    removerDoContainer(alvo.container, alvo.p);
    return;
  }

  definirTextoDoParagrafoRemovendoRuns(alvo.p, linhas[0]);
  let ancora = alvo.p;
  for (const linha of linhas.slice(1)) {
    const novo = clonar(alvo.p);
    inserirDepois(alvo.container, ancora, novo);
    ancora = novo;
    definirTextoDoParagrafoRemovendoRuns(novo, linha);
  }
}

/** Token EM LINHA: substituído dentro do parágrafo, preservando o texto ao redor —
 * `fill_inline_token()`. Linhas extras entram como quebra dentro da mesma run. */
function preencherTokenEmLinha(
  paragrafos: ParagrafoLocalizado[],
  nome: string,
  valor: string,
): void {
  const token = `{{${nome}}}`;
  const linhas = (valor || '').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (linhas.length > 0 && !linhas[0].trim()) linhas.shift();
  while (linhas.length > 0 && !linhas[linhas.length - 1].trim()) linhas.pop();
  const primeira = linhas.length > 0 ? linhas[0] : '';
  const restantes = linhas.slice(1);

  for (const { p } of paragrafos) {
    // O guarda existe no original para não girar para sempre caso a substituição não
    // remova o token (por exemplo, se o próprio valor contiver o token).
    let guarda = 0;
    while (textoDoParagrafo(p).includes(token)) {
      const idx = textoDoParagrafo(p).indexOf(token);
      const run = substituirTrechoNasRuns(
        runsDoParagrafo(p),
        idx,
        idx + token.length,
        primeira,
        true,
      );
      if (run && restantes.length > 0) {
        for (const linha of restantes) acrescentarQuebraETexto(run, linha);
      }
      guarda += 1;
      if (guarda > 50) break;
    }
  }
}

function preencherTokens(doc: DocumentoDocx, dados: DadosProjeto): void {
  for (const nome of TOKENS_BLOCO) {
    preencherTokenBloco(
      doc.paragrafosEmOrdem(),
      nome,
      dados.campos[nome] ?? '',
    );
  }
  // Os tokens em linha não têm lista fixa: são os que sobraram no documento.
  const emLinha = new Set<string>();
  for (const { p } of doc.paragrafosEmOrdem()) {
    for (const m of textoDoParagrafo(p).matchAll(TOKEN_RE)) {
      emLinha.add(m[0].slice(2, -2));
    }
  }
  for (const nome of emLinha) {
    preencherTokenEmLinha(
      doc.paragrafosEmOrdem(),
      nome,
      dados.campos[nome] ?? '',
    );
  }
}

// --- 3) tabela de usuários / 4) equipe ---------------------------------------------------

function acharTabelaDeUsuarios(doc: DocumentoDocx): No | null {
  for (const tbl of doc.tabelas()) {
    const linhas = linhasDaTabela(tbl);
    if (linhas.length === 0) continue;
    const cabecalho = celulasDaLinha(linhas[0])
      .map((c) => normalizarDoc(textoDaCelula(c)))
      .join(' ');
    if (cabecalho.includes('assina protocolo') && cabecalho.includes('nome')) {
      return tbl;
    }
  }
  return null;
}

/** Reconstrói a Tabela de Usuários — `rebuild_users_table()`: a 2ª linha do template serve de
 * molde e é clonada por usuário, preservando bordas e sombreado. Sem usuários, fica uma
 * linha em branco (o documento é assinado em papel). */
function reconstruirTabelaDeUsuarios(
  doc: DocumentoDocx,
  usuarios: UsuarioProjeto[],
): void {
  const tbl = acharTabelaDeUsuarios(doc);
  if (!tbl) return;
  const linhas = linhasDaTabela(tbl);
  if (linhas.length < 2) return;

  const molde = clonar(linhas[1]);
  const filhos = filhosDe(tbl);
  for (const tr of linhas.slice(1)) removerDoContainer(filhos, tr);

  const lista =
    usuarios.length > 0
      ? usuarios
      : [{ nome: '', email: '', area: '', assina: '' }];
  for (const u of lista) {
    const nova = clonar(molde);
    filhos.push(nova);
    const valores = [u.nome ?? '', u.email ?? '', u.area ?? '', u.assina ?? ''];
    celulasDaLinha(nova).forEach((tc, i) => {
      definirTextoDaCelulaMantendoEstilo(tc, valores[i] ?? '');
    });
  }
}

/** Acrescenta o nome ao lado do rótulo da equipe — `fill_equipe()`. */
function preencherEquipe(
  doc: DocumentoDocx,
  equipe: Record<string, string>,
): void {
  if (Object.keys(equipe).length === 0) return;
  const alvos = new Map(
    CAMPOS_EQUIPE.map(([chave, rotulo]) => [normalizarDoc(rotulo), chave]),
  );
  for (const { p } of doc.paragrafosEmOrdem()) {
    const chave = alvos.get(normalizarDoc(textoDoParagrafo(p)));
    const valor = chave ? equipe[chave] : undefined;
    if (!valor) continue;
    const run: No = { 'w:r': [] };
    filhosDe(p).push(run);
    definirTextoDaRun(run, ` ${String(valor).trim()}`);
    limparCorDaRun(run);
  }
}

// --- 5) marcadores / 6) typos / 7) bordas ------------------------------------------------

async function limparMarcadores(doc: DocumentoDocx): Promise<void> {
  for (const { p } of doc.paragrafosEmOrdem()) limparMarcadoresDoParagrafo(p);
  // Cabeçalho e rodapé também carregam marcação no template.
  for (const parte of await doc.partesDeCabecalhoRodape()) {
    for (const p of todosOsParagrafos(parte.raiz)) {
      limparMarcadoresDoParagrafo(p);
    }
    doc.regravarParte(parte.nome, parte.raiz);
  }
}

function corrigirTypos(doc: DocumentoDocx): void {
  for (const { p } of doc.paragrafosEmOrdem()) {
    for (const [errado, certo] of CORRECOES) {
      const texto = textoDoParagrafo(p);
      const idx = texto.indexOf(errado);
      if (idx >= 0) {
        substituirTrechoNasRuns(
          runsDoParagrafo(p),
          idx,
          idx + errado.length,
          certo,
        );
      }
    }
  }
}

/** Aplica toda a engine sobre o template e devolve o .docx pronto. Separado de `gerar()`
 * para o teste inspecionar sem escrever em disco. */
export async function montarDocumento(
  y: DadosProjetoYaml = carregarYaml<DadosProjetoYaml>('projeto.yaml'),
): Promise<Buffer> {
  if (!templateExiste()) {
    throw new Error(
      'Template tokenizado ausente: tools/templates/base_projeto_tokenizado.docx',
    );
  }
  const dados = montarDados(y);
  const doc = await DocumentoDocx.abrir(CAMINHO_TEMPLATE);

  removerAreasNaoIncluidas(doc, dados.areasIncluidas);
  preencherTokens(doc, dados);
  reconstruirTabelaDeUsuarios(doc, dados.usuarios);
  preencherEquipe(doc, dados.equipe);
  await limparMarcadores(doc);
  corrigirTypos(doc);
  for (const tbl of doc.tabelas()) garantirBordasDaTabela(tbl);

  return doc.gravar();
}

/** Gera o arquivo em `exemplos/`, com o mesmo nome do original. */
export async function gerar(): Promise<string> {
  const y = carregarYaml<DadosProjetoYaml>('projeto.yaml');
  const buffer = await montarDocumento(y);
  mkdirSync(OUT_DIR, { recursive: true });
  const caminho = join(
    OUT_DIR,
    `Projeto_Implantacao_${slug(y.client_name ?? 'cliente')}.docx`,
  );
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
