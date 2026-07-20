import { createHash } from 'crypto';

export type CategoriaSecao =
  | 'identificacao'
  | 'configuracao'
  | 'rotina'
  | 'dependencia'
  | 'suporte'
  | 'checklist'
  | 'palavras-chave'
  | 'geral';

/** Trecho de texto inline com marcação leve (negrito / código). */
export interface Segmento {
  texto: string;
  forte?: boolean;
  codigo?: boolean;
}

/** Bloco estruturado do corpo de uma seção — para a tela renderizar de forma legível
 * (tabela como tabela, lista como lista, etc.), não markdown "cru". */
export type Bloco =
  | { tipo: 'subtitulo'; segmentos: Segmento[] }
  | { tipo: 'paragrafo'; segmentos: Segmento[] }
  | { tipo: 'lista'; itens: Segmento[][] }
  | { tipo: 'tabela'; cabecalho: Segmento[][]; linhas: Segmento[][][] }
  | { tipo: 'codigo'; texto: string };

export interface SecaoDocumento {
  titulo: string;
  corpo: string;
  categoria: CategoriaSecao;
  blocos: Bloco[];
}

export interface DocumentoParseado {
  titulo: string;
  sigla: string;
  resumo: string;
  secoes: SecaoDocumento[];
  palavrasChave: string[];
  hashConteudo: string;
}

// Classificação de cada seção pelo título (títulos seguem o padrão do PROMPT_PRINCIPAL.md do
// repositório de documentação: "## N. Configuracoes disponiveis...", etc.). Sem acento e em
// minúsculo para casar independente de variação de escrita.
function classificarSecao(tituloNormalizado: string): CategoriaSecao {
  // Radicais (sem sufixo) para casar singular e plural: "configuracao"/"configuracoes",
  // "dependencia"/"dependencias", "rotina"/"rotinas", etc.
  const t = tituloNormalizado;
  if (
    t.includes('identificac') ||
    t.includes('papel operacional') ||
    t.includes('evidencia')
  )
    return 'identificacao';
  if (t.includes('configurac') || t.includes('parametro'))
    return 'configuracao';
  if (t.includes('rotina') || t.includes('menu') || t.includes('arquitetura'))
    return 'rotina';
  if (t.includes('dependencia') || t.includes('estrutura'))
    return 'dependencia';
  if (t.includes('suporte') || t.includes('erro')) return 'suporte';
  if (t.includes('checklist')) return 'checklist';
  if (t.includes('palavra')) return 'palavras-chave';
  return 'geral';
}

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(texto: string): string {
  return removerAcentos(texto).toLowerCase().trim();
}

/** Extrai os termos entre crases (`CTB106`, `1.6-T`, `CWREGEMP.CPY`) — o padrão de programa/
 * copybook/menu usado na documentação — de um trecho de markdown. */
export function extrairTermosCodigo(markdown: string): string[] {
  const termos = new Set<string>();
  const regex = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(markdown)) !== null) {
    const valor = m[1].trim();
    // Só termos "de código" curtos e sem espaço — evita capturar frases inteiras em crase.
    // Descarta citações de evidência por caminho (`F:\Fontes\X.CBL:12`), que são ruído para
    // a busca — o que interessa é o nome do programa/copybook/menu, não o path da evidência.
    const ehCaminho =
      valor.includes('\\') || valor.includes('/') || /:\d/.test(valor);
    if (
      valor.length >= 2 &&
      valor.length <= 40 &&
      !valor.includes(' ') &&
      !ehCaminho
    ) {
      termos.add(valor);
    }
  }
  return [...termos];
}

/** Faz o parse de um documento markdown da base SIGER em título, sigla, resumo, seções
 * classificadas e palavras-chave. Puro Node/TypeScript — sem dependência externa. */
export function parseDocumentoMarkdown(markdown: string): DocumentoParseado {
  const linhas = markdown.split(/\r?\n/);

  let titulo = '';
  const secoes: SecaoDocumento[] = [];
  let secaoAtual: { titulo: string; linhas: string[] } | null = null;

  const empurrarSecao = () => {
    if (secaoAtual) {
      const corpo = secaoAtual.linhas.join('\n').trim();
      secoes.push({
        titulo: secaoAtual.titulo,
        corpo,
        categoria: classificarSecao(normalizar(secaoAtual.titulo)),
        blocos: parseBlocos(corpo),
      });
    }
  };

  for (const linha of linhas) {
    const h1 = /^#\s+(.+)$/.exec(linha);
    const h2 = /^##\s+(.+)$/.exec(linha);
    if (h1 && !titulo) {
      titulo = h1[1].trim();
      continue;
    }
    if (h2) {
      empurrarSecao();
      secaoAtual = { titulo: h2[1].trim(), linhas: [] };
      continue;
    }
    if (secaoAtual) {
      secaoAtual.linhas.push(linha);
    }
  }
  empurrarSecao();

  // Sigla: primeira palavra do título antes do " - " (ex.: "CTB - Contabilidade" -> "CTB").
  const sigla = (titulo.split(/[-–]/)[0] ?? '').trim().split(/\s+/)[0] ?? '';

  // Resumo: a seção de papel operacional/identificação, senão o primeiro parágrafo com texto.
  const secaoResumo =
    secoes.find((s) => normalizar(s.titulo).includes('papel operacional')) ??
    secoes.find((s) => s.categoria === 'identificacao');
  const resumo =
    (secaoResumo?.corpo ?? '')
      .split('\n')
      .find(
        (l) =>
          l.trim().length > 0 &&
          !l.trim().startsWith('|') &&
          !l.trim().startsWith('#'),
      )
      ?.trim()
      .slice(0, 600) ?? '';

  // Palavras-chave: termos de código de todo o documento + os da seção "Palavras-chave".
  const palavrasChave = extrairTermosCodigo(markdown);

  const hashConteudo = createHash('sha256')
    .update(markdown, 'utf8')
    .digest('hex');

  return { titulo, sigla, resumo, secoes, palavrasChave, hashConteudo };
}

/** Quebra um texto inline em segmentos com marcação leve: **negrito** e `código`. Puro TS,
 * sem regex de HTML — o frontend renderiza cada segmento com <strong>/<code>, sem innerHTML. */
export function segmentarInline(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  // Divide preservando os delimitadores **...** e `...`.
  const partes = texto
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((p) => p !== '');
  for (const parte of partes) {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) {
      segmentos.push({ texto: parte.slice(2, -2), forte: true });
    } else if (
      parte.startsWith('`') &&
      parte.endsWith('`') &&
      parte.length > 2
    ) {
      segmentos.push({ texto: parte.slice(1, -1), codigo: true });
    } else {
      segmentos.push({ texto: parte });
    }
  }
  return segmentos.length > 0 ? segmentos : [{ texto }];
}

function celulasDaLinhaTabela(linha: string): string[] {
  // "| a | b |" -> ["a", "b"] (remove as bordas e espaços).
  return linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function ehSeparadorTabela(linha: string): boolean {
  // Linha "|---|:--:|---|" logo abaixo do cabeçalho.
  return /^\|?[\s:|-]+\|?$/.test(linha.trim()) && linha.includes('-');
}

/** Converte o markdown de uma seção em blocos estruturados (subtítulo, parágrafo, lista,
 * tabela, código). Cobre o que a documentação do SIGER usa; o que não casar vira parágrafo. */
export function parseBlocos(markdown: string): Bloco[] {
  const linhas = markdown.split(/\r?\n/);
  const blocos: Bloco[] = [];
  let i = 0;

  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    const texto = paragrafo.join(' ').trim();
    if (texto)
      blocos.push({ tipo: 'paragrafo', segmentos: segmentarInline(texto) });
    paragrafo = [];
  };

  while (i < linhas.length) {
    const linha = linhas[i];
    const trim = linha.trim();

    // Bloco de código cercado por ```
    if (trim.startsWith('```')) {
      fecharParagrafo();
      const codigo: string[] = [];
      i += 1;
      while (i < linhas.length && !linhas[i].trim().startsWith('```')) {
        codigo.push(linhas[i]);
        i += 1;
      }
      i += 1; // fecha o ```
      blocos.push({ tipo: 'codigo', texto: codigo.join('\n') });
      continue;
    }

    // Subtítulo (###, ####…)
    const sub = /^#{3,6}\s+(.+)$/.exec(trim);
    if (sub) {
      fecharParagrafo();
      blocos.push({
        tipo: 'subtitulo',
        segmentos: segmentarInline(sub[1].trim()),
      });
      i += 1;
      continue;
    }

    // Tabela: linha começa com "|" e a próxima é o separador |---|
    if (
      trim.startsWith('|') &&
      i + 1 < linhas.length &&
      ehSeparadorTabela(linhas[i + 1])
    ) {
      fecharParagrafo();
      const cabecalho = celulasDaLinhaTabela(trim).map(segmentarInline);
      i += 2; // pula cabeçalho + separador
      const linhasTab: Segmento[][][] = [];
      while (i < linhas.length && linhas[i].trim().startsWith('|')) {
        linhasTab.push(celulasDaLinhaTabela(linhas[i]).map(segmentarInline));
        i += 1;
      }
      blocos.push({ tipo: 'tabela', cabecalho, linhas: linhasTab });
      continue;
    }

    // Lista (- ou *)
    if (/^[-*]\s+/.test(trim)) {
      fecharParagrafo();
      const itens: Segmento[][] = [];
      while (i < linhas.length && /^[-*]\s+/.test(linhas[i].trim())) {
        itens.push(segmentarInline(linhas[i].trim().replace(/^[-*]\s+/, '')));
        i += 1;
      }
      blocos.push({ tipo: 'lista', itens });
      continue;
    }

    // Linha em branco fecha o parágrafo corrente
    if (trim === '') {
      fecharParagrafo();
      i += 1;
      continue;
    }

    paragrafo.push(trim);
    i += 1;
  }
  fecharParagrafo();
  return blocos;
}
