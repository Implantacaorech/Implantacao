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

export interface SecaoDocumento {
  titulo: string;
  corpo: string;
  categoria: CategoriaSecao;
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
