import {
  CategoriaWalleArquivo,
  OrigemWalleArquivo,
} from '../database/entities/walle-arquivo.entity';
import { TipoWalleEntidade } from '../database/entities/walle-entidade.entity';

/** Funções PURAS de extração/normalização usadas pela indexação e pela busca do módulo
 * Wall-e. Tudo aqui é heurística documentada e testável — nada consulta banco, disco ou
 * IA. A regra geral: melhor deixar de extrair do que inventar (a busca degrada bem com
 * menos entidade; alucina mal com entidade errada). */

export interface EntidadeExtraida {
  tipo: TipoWalleEntidade;
  valor: string;
}

const EXTENSOES_IMAGEM = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
const EXTENSOES_TEXTO = new Set(['md', 'sql', 'log', 'txt', 'csv', 'json']);

export function ehImagem(extensao: string): boolean {
  return EXTENSOES_IMAGEM.has(extensao);
}
export function ehTexto(extensao: string): boolean {
  return EXTENSOES_TEXTO.has(extensao);
}

/** Decodifica o buffer como UTF-8; se o resultado vier crivado de U+FFFD (arquivo salvo em
 * Windows-1252/latin1, comum em log do SIGER), redecodifica como latin1. */
export function decodificarTexto(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  const substituicoes = (utf8.match(/�/g) ?? []).length;
  if (substituicoes > 0 && substituicoes > utf8.length / 500) {
    return buf.toString('latin1');
  }
  return utf8;
}

/** Minúsculas e sem acento — base de TODA comparação de busca (pergunta com/sem acento
 * encontra o mesmo documento). */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Título legível: 1º `# H1` do markdown; 1ª linha de comentário com letras do SQL; ou o
 * nome do arquivo embelezado (hífens/underscores viram espaço, sem extensão). */
export function extrairTitulo(
  conteudo: string,
  nome: string,
  extensao: string,
): string {
  if (extensao === 'md') {
    const h1 = /^#\s+(.+)$/m.exec(conteudo);
    if (h1) return h1[1].trim().slice(0, 300);
  }
  if (extensao === 'sql') {
    for (const linha of conteudo.split('\n').slice(0, 10)) {
      const m = /^--\s*(.*[a-zA-ZÀ-ú].*)$/.exec(linha.trim());
      if (m && !/^[=\-\s]*$/.test(m[1])) return m[1].trim().slice(0, 300);
    }
  }
  const semExt = nome.replace(/\.[^.]+$/, '');
  return semExt.replace(/[-_]+/g, ' ').trim().slice(0, 300);
}

/** Resumo para o card: 1º parágrafo útil (fora de heading/código/tabela) do markdown, o
 * bloco de comentários de abertura do SQL, ou as primeiras linhas do log. */
export function extrairResumo(conteudo: string, extensao: string): string {
  const LIMITE = 400;
  if (extensao === 'md') {
    let dentroDeCodigo = false;
    const paragrafo: string[] = [];
    for (const bruta of conteudo.split('\n')) {
      const linha = bruta.trim();
      if (linha.startsWith('```')) {
        dentroDeCodigo = !dentroDeCodigo;
        continue;
      }
      if (dentroDeCodigo) continue;
      if (
        linha === '' ||
        linha.startsWith('#') ||
        linha.startsWith('|') ||
        linha.startsWith('---')
      ) {
        if (paragrafo.length > 0) break;
        continue;
      }
      paragrafo.push(linha.replace(/^[>*-]\s*/, ''));
      if (paragrafo.join(' ').length > LIMITE) break;
    }
    return aparar(paragrafo.join(' '), LIMITE);
  }
  if (extensao === 'sql') {
    const comentarios = conteudo
      .split('\n')
      .slice(0, 15)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('--'))
      .map((l) => l.replace(/^--\s?/, '').trim())
      .filter((l) => l !== '' && !/^[=\-\s*]+$/.test(l));
    return aparar(comentarios.join(' '), LIMITE);
  }
  if (extensao === 'log') {
    return aparar(conteudo.split('\n').slice(0, 2).join(' '), LIMITE);
  }
  return '';
}

function aparar(texto: string, limite: number): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length <= limite ? t : `${t.slice(0, limite - 1)}…`;
}

/** Classificação automática (§11 da especificação) — heurística por extensão + palavras do
 * título/nome/início do conteúdo. Ordem importa: do mais específico ao genérico. */
export function classificar(
  nome: string,
  extensao: string,
  conteudo: string,
): CategoriaWalleArquivo {
  if (ehImagem(extensao)) return 'imagem';
  if (extensao === 'sql') return 'sql';
  if (extensao === 'log') return 'log';
  // Hífen/underscore do nome de arquivo conta como espaço ("porque-carimbou" ⇒ "porque
  // carimbou") — senão a heurística perderia o sinal que está no próprio nome.
  const alvo = normalizar(`${nome} ${conteudo.slice(0, 2000)}`).replace(/[-_]+/g, ' ');
  if (/causa[- ]raiz|porque carimbou|por que carimbou/.test(alvo)) {
    return 'causa-raiz';
  }
  if (/estatistica|indicador(es)? de adocao/.test(alvo)) return 'estatistica';
  if (/texto para a rns|proposta|rns[- ]estatistica/.test(alvo)) {
    return 'proposta';
  }
  if (/investigac|ha robo|existe (algum )?robo/.test(alvo)) {
    return 'investigacao';
  }
  if (/levantamento|decisoes|toolchain|roteamento|plano|verificacao|hierarquia/.test(alvo)) {
    return 'planejamento';
  }
  if (extensao === 'md' || /analise/.test(alvo)) return 'analise';
  return 'outro';
}

/** Produzido pelo Wall-e × recebido como insumo (§38). Nunca chuta com convicção: log e
 * imagem chegam como insumo do técnico; .md/.sql neste acervo são as entregas do bot (e a
 * assinatura "Elaborado por Wall-e" confirma); o resto fica indeterminado. */
export function detectarOrigem(
  extensao: string,
  conteudo: string,
): OrigemWalleArquivo {
  if (ehImagem(extensao) || extensao === 'log') return 'insumo';
  if (/elaborado por wall-e|wall-e \(t[ée]cnico 900\)/i.test(conteudo)) {
    return 'produzido';
  }
  if (extensao === 'md' || extensao === 'sql') return 'produzido';
  return 'indeterminado';
}

// Palavras maiúsculas que parecem tabela/programa mas são ruído de SQL/log/markdown.
const RUIDO_MAIUSCULAS = new Set([
  'SELECT', 'UPDATE', 'INSERT', 'DELETE', 'MERGE', 'COMMIT', 'ROLLBACK', 'WHERE',
  'ORDER', 'GROUP', 'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'TABLE',
  'INDEX', 'VIEW', 'NULL', 'NOT', 'AND', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'VARCHAR2', 'NUMBER', 'TIMESTAMP', 'DATE', 'CHAR', 'INFO', 'WARN', 'ERROR',
  'DEBUG', 'TODO', 'FIXME', 'IMPORTANTE', 'OBS', 'ATENCAO', 'PREVIEW', 'MOVE',
  'POST', 'GET', 'PUT', 'PATCH', 'HTTP', 'HTTPS', 'JSON', 'API', 'URL', 'PDF',
  'TO_DATE', 'SYSDATE', 'STATUS', 'CODIGO', 'BETWEEN', 'DISTINCT', 'HAVING',
]);

// Tabelas conhecidas do SICLA/SIGER sem underscore (o padrão com `_` já casa sozinho).
const TABELAS_CONHECIDAS = new Set([
  'ITEMPED', 'FICHAS', 'RECADOS', 'DIALOGO', 'MOVIMENTOS', 'CLIENTES', 'TECNICOS',
  'PEDIDO', 'ATUSISTEMAS', 'FUNCOES', 'LOGSESSAO', 'WEBHOOKS', 'ENVIADAS',
]);

// Tecnologias/componentes que valem como entidade e assunto quando citados.
const TECNOLOGIAS = [
  'whatsapp', 'node', 'rust', 'delphi', 'cobol', 'java', 'ruby', 'python',
  'angular', 'nestjs', 'react', 'tauri', 'oracle', 'mariadb', 'sqlite', 'gitlab',
  'git', 'cron', 'webhook', 'claude', 'datamart', 'typescript', 'javascript',
  'flask', 'fastapi', 'svn', 'iscobol',
];

/** Extrai entidades (RNS, Ficha, tabela, repositório, programa, erro, tecnologia,
 * cliente) por regex/dicionário. Valores normalizados: MAIÚSCULAS para tabela/erro/
 * programa, minúsculas para repositório/tecnologia. */
export function extrairEntidades(texto: string): EntidadeExtraida[] {
  const achadas = new Map<string, EntidadeExtraida>();
  const poe = (tipo: TipoWalleEntidade, valor: string) => {
    const v = valor.trim();
    if (v) achadas.set(`${tipo}:${v}`, { tipo, valor: v });
  };

  // RNS: forma completa 563996-1 e forma citada "RNS 563996".
  for (const m of texto.matchAll(/\b(\d{6})-(\d{1,2})\b/g)) {
    poe('rns', `${m[1]}-${Number(m[2])}`);
  }
  for (const m of texto.matchAll(/\bRNS\s+(\d{6})\b/gi)) poe('rns', m[1]);

  // Ficha 324397 / ficha nº 853.
  for (const m of texto.matchAll(/\bficha\s*(?:n[ºo°.]?\s*)?(\d{3,6})\b/gi)) {
    poe('ficha', m[1]);
  }

  // Tabelas: MAIÚSCULAS com underscore (FILA_WALLE) ou da lista conhecida (ITEMPED).
  for (const m of texto.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)) {
    const v = m[0];
    if (v.length <= 30 && !RUIDO_MAIUSCULAS.has(v) && !/^(ORA|DPY|PLS|TNS|SP2)_/.test(v)) {
      poe('tabela', v);
    }
  }
  for (const m of texto.matchAll(/\b[A-Z]{5,15}\b/g)) {
    if (TABELAS_CONHECIDAS.has(m[0])) poe('tabela', m[0]);
  }

  // Repositórios internos: ri-*, nri*, riconcha, e o último segmento de URLs do GitLab.
  for (const m of texto.matchAll(/\b(ri-[a-z][a-z0-9-]+|nri[a-z][a-z0-9]*|riconcha)\b/gi)) {
    poe('repositorio', m[1].toLowerCase());
  }
  for (const m of texto.matchAll(/gitlab\.rech\.com\.br\/[\w\-./]+/gi)) {
    const partes = m[0].replace(/\/+$/, '').split('/');
    const ultimo = partes[partes.length - 1]?.toLowerCase();
    if (ultimo && ultimo.length > 2) poe('repositorio', ultimo);
  }

  // Códigos de erro: ORA-01400, DPY-3015…
  for (const m of texto.matchAll(/\b(ORA|DPY|PLS|TNS|SP2)-\d{3,6}\b/gi)) {
    poe('erro', m[0].toUpperCase());
  }

  // Programas SIGER/SICLA: 3 letras + 3 dígitos (CTB106, SRI049).
  for (const m of texto.matchAll(/\b[A-Z]{3}\d{3}\b/g)) {
    poe('programa', m[0]);
  }

  // Tecnologias por dicionário (palavra inteira no texto normalizado).
  const norm = normalizar(texto);
  for (const t of TECNOLOGIAS) {
    if (new RegExp(`\\b${t}\\b`).test(norm)) poe('tecnologia', t);
  }

  // Cliente numerado ("cliente 4070"). Nome de cliente não é extraído de propósito —
  // risco alto de falso positivo, e a busca textual já cobre.
  for (const m of texto.matchAll(/\bcliente\s+(\d{3,5})\b/gi)) {
    poe('cliente', m[1]);
  }

  return [...achadas.values()];
}

// Vocabulário de assuntos do domínio — o que faz "integração" virar assunto clicável.
const ASSUNTOS_DOMINIO = [
  'integracao', 'automacao', 'estatistica', 'conversao', 'fila', 'chat', 'bot',
  'robo', 'e-mail', 'relatorio', 'migracao', 'apontamento', 'producao',
  'moeda estrangeira', 'materiais', 'rnc', 'spool', 'impressao', 'adocao',
  'roteamento', 'permissao', 'dashboard', 'mensagem', 'agenda', 'log',
  'levantamento', 'treinamento', 'implantacao',
];

const STOPWORDS = new Set([
  'para', 'como', 'sobre', 'este', 'esta', 'esse', 'essa', 'entre', 'pelo',
  'pela', 'com', 'sem', 'dos', 'das', 'que', 'nao', 'uma', 'por', 'mais',
  'hoje', 'apos', 'ate', 'ser', 'foi', 'sao', 'tem', 'seu', 'sua', 'the',
]);

/** Assuntos do documento (§12): tecnologias citadas + vocabulário do domínio presente no
 * texto + palavras significativas do título. Sem acento e em minúsculas (chave de busca);
 * a tela exibe como chip. */
export function extrairAssuntos(
  titulo: string,
  conteudo: string,
  entidades: EntidadeExtraida[],
): string[] {
  const assuntos = new Set<string>();
  const norm = normalizar(`${titulo}\n${conteudo}`);
  for (const a of ASSUNTOS_DOMINIO) {
    if (norm.includes(a)) assuntos.add(a);
  }
  for (const e of entidades) {
    if (e.tipo === 'tecnologia') assuntos.add(e.valor);
  }
  for (const palavra of normalizar(titulo).split(/[^a-z0-9]+/)) {
    if (palavra.length > 3 && !STOPWORDS.has(palavra) && !/^\d+$/.test(palavra)) {
      assuntos.add(palavra);
    }
  }
  return [...assuntos].slice(0, 20);
}

/** Sinônimos/conceitos relacionados para expansão da pergunta (§8): quem pesquisa
 * "integração" também deve achar API/webhook/cron. Expansão pesa MENOS que o termo
 * literal na pontuação — relação semântica nunca supera correspondência direta. */
export const SINONIMOS: Record<string, string[]> = {
  integracao: ['api', 'webhook', 'cron', 'servico', 'mensagem'],
  robo: ['bot', 'automacao', 'cron'],
  bot: ['robo', 'automacao'],
  whatsapp: ['mensagem', 'meta', 'webhook'],
  erro: ['falha', 'problema', 'defeito'],
  problema: ['erro', 'falha', 'defeito'],
  apontamento: ['movimento', 'producao', 'ficha'],
  estatistica: ['adocao', 'indicador', 'metrica'],
  sql: ['script', 'consulta', 'query'],
  analise: ['investigacao', 'estudo', 'parecer'],
  investigacao: ['analise', 'estudo'],
  moeda: ['cambio', 'dolar', 'estrangeira'],
  repositorio: ['projeto', 'gitlab', 'repo'],
  fila: ['queue', 'processamento'],
};
