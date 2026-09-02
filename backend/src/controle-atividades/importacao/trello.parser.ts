import { ETIQUETAS } from '../controle-atividades.constants';

/** Leitura do JSON que o Trello exporta (menu do quadro → Compartilhar → Exportar como JSON).
 *
 * **Por que o arquivo, e não a API do Trello:** o JSON sai no plano gratuito, não pede chave
 * nem token, não tem limite de chamadas e não exige que o Painel alcance a internet — o que
 * importa porque a instância é interna e vai para a nuvem em breve. Quem exporta é o dono do
 * quadro, então nem credencial do Trello circula.
 *
 * Tudo aqui é PURO: entra texto, sai um plano de importação. Sem banco, sem Nest. É o que
 * permite cobrir o formato do Trello com testes de verdade, inclusive os casos torto — que
 * são a regra num arquivo que vem de fora. */

// ── O que o Trello manda (só o que a gente usa; o resto do arquivo é ignorado) ──

interface TrelloLista {
  id?: unknown;
  name?: unknown;
  closed?: unknown;
  pos?: unknown;
}

interface TrelloEtiqueta {
  name?: unknown;
  color?: unknown;
}

interface TrelloAnexo {
  name?: unknown;
  url?: unknown;
  isUpload?: unknown;
}

interface TrelloCartao {
  id?: unknown;
  name?: unknown;
  desc?: unknown;
  idList?: unknown;
  closed?: unknown;
  pos?: unknown;
  due?: unknown;
  dueComplete?: unknown;
  labels?: unknown;
  idMembers?: unknown;
  attachments?: unknown;
}

interface TrelloItemChecklist {
  name?: unknown;
  state?: unknown;
  pos?: unknown;
}

interface TrelloChecklist {
  idCard?: unknown;
  name?: unknown;
  checkItems?: unknown;
  pos?: unknown;
}

interface TrelloMembro {
  id?: unknown;
  fullName?: unknown;
  username?: unknown;
}

interface TrelloAcao {
  type?: unknown;
  date?: unknown;
  data?: unknown;
  memberCreator?: unknown;
}

// ── O que sai daqui: o plano de importação ──

export interface AnexoImportado {
  nome: string;
  url: string;
  /** Era arquivo enviado ao Trello (e não um link que alguém colou). */
  eraArquivo: boolean;
}

export interface CartaoImportado {
  idTrello: string;
  titulo: string;
  descricao: string;
  idListaTrello: string;
  ordem: number;
  /** `YYYY-MM-DD`, no formato de data do Painel. Vazio quando o Trello não tinha prazo. */
  prazo: string;
  concluido: boolean;
  /** Chaves do catálogo do Painel que casaram com as etiquetas do Trello. */
  etiquetas: string[];
  /** Nomes de etiqueta do Trello que NÃO casaram — vão para o relatório, não somem calados. */
  etiquetasNaoMapeadas: string[];
  membros: string[];
  checklist: { texto: string; feito: boolean }[];
  anexos: AnexoImportado[];
  comentarios: { autor: string; texto: string; data: string }[];
}

export interface ListaImportada {
  idTrello: string;
  titulo: string;
  ordem: number;
}

export interface PlanoImportacao {
  nomeQuadro: string;
  listas: ListaImportada[];
  cartoes: CartaoImportado[];
  membros: string[];
  /** Contagens e ressalvas que a tela mostra ANTES de confirmar. */
  resumo: {
    listas: number;
    cartoes: number;
    cartoesArquivados: number;
    listasArquivadas: number;
    checklistItens: number;
    comentarios: number;
    anexosLink: number;
    anexosArquivo: number;
    etiquetasNaoMapeadas: string[];
  };
  avisos: string[];
}

export class TrelloInvalidoError extends Error {}

// ── Utilidades de leitura defensiva ──
// O arquivo vem de FORA. Nada aqui pode assumir tipo: um campo ausente, nulo ou com o tipo
// trocado precisa virar valor vazio, nunca exceção no meio da importação.

const texto = (v: unknown, teto = 0): string => {
  const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  return teto ? s.slice(0, teto) : s;
};
const numero = (v: unknown, padrao = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : padrao;
const verdade = (v: unknown): boolean => v === true;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** `2026-09-10T12:00:00.000Z` → `2026-09-10`.
 *
 * Corta a parte da data em UTC, sem converter fuso. O prazo do Trello é uma data com hora,
 * mas no Painel prazo é o DIA — e converter para o fuso local faria um vencimento de
 * 10/09 00:00Z virar 09/09 no Brasil, adiantando todo prazo em um dia. */
export function dataDoTrello(v: unknown): string {
  const s = texto(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : '';
}

/** Etiqueta do Trello → chave do catálogo do Painel, comparando por NOME sem acento/caixa.
 *
 * Por nome, e não por cor: cor no Trello é decoração e cada quadro usa a sua; nome é o que a
 * pessoa escreveu e é onde mora o significado. Casa também quando um contém o outro
 * ("Conversão de dados" → `conv`), porque nome de etiqueta raramente é idêntico. */
export function mapearEtiqueta(nome: string): string | null {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  for (const e of ETIQUETAS) {
    const ref = normalizar(e.nome);
    if (alvo === ref || alvo.includes(ref) || ref.includes(alvo))
      return e.chave;
  }
  return null;
}

function normalizar(s: string): string {
  return (
    s
      .normalize('NFD')
      // Propriedade Unicode, e nao o intervalo U+0300-U+036F escrito a mao: assim o
      // fonte fica em ASCII puro. Escrito como intervalo, os caracteres viram bytes
      // invisiveis no arquivo e somem numa conversao de encoding desatenta, levando
      // junto, em silencio, a comparacao sem acento. Ja aconteceu neste repositorio
      // (ver matriz-detalhada/menus-siger.service.ts, que ainda tem o literal).
      .replace(/\p{Mn}/gu, '')
      .toLowerCase()
      .trim()
  );
}

/** Lê o JSON exportado pelo Trello e devolve o plano do que seria importado.
 *
 * **Não escreve nada.** Quem grava é o service, e só depois de a pessoa confirmar a prévia —
 * importação de arquivo alheio é o tipo de operação que não se desfaz num clique. */
export function lerExportacaoTrello(bruto: string): PlanoImportacao {
  let raiz: Record<string, unknown>;
  try {
    raiz = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    throw new TrelloInvalidoError(
      'O arquivo não é um JSON válido. Exporte de novo pelo Trello (menu do quadro → ' +
        'Compartilhar → Exportar como JSON) e envie o arquivo sem editar.',
    );
  }
  if (!raiz || typeof raiz !== 'object' || Array.isArray(raiz)) {
    throw new TrelloInvalidoError(
      'O arquivo não parece uma exportação do Trello.',
    );
  }
  // `lists` e `cards` são o mínimo que qualquer exportação de quadro tem. Sem os dois, ou o
  // arquivo é de outra coisa, ou é a exportação de um CARTÃO só — que não serve aqui.
  if (!Array.isArray(raiz['lists']) || !Array.isArray(raiz['cards'])) {
    throw new TrelloInvalidoError(
      'Não achei as listas e os cartões no arquivo. Exporte o QUADRO inteiro como JSON — ' +
        'a exportação de um cartão isolado não serve.',
    );
  }

  const avisos: string[] = [];

  // ── listas ──
  const listasBrutas = lista(raiz['lists']) as TrelloLista[];
  const arquivadas = listasBrutas.filter((l) => verdade(l.closed)).length;
  const listas: ListaImportada[] = listasBrutas
    .filter((l) => !verdade(l.closed))
    .map((l) => ({
      idTrello: texto(l.id),
      titulo: texto(l.name, 80) || 'Sem título',
      ordem: numero(l.pos),
    }))
    .sort((a, b) => a.ordem - b.ordem);
  const idsDeLista = new Set(listas.map((l) => l.idTrello));

  // ── checklists, indexados por cartão ──
  const checklistPorCartao = new Map<
    string,
    { texto: string; feito: boolean }[]
  >();
  for (const c of lista(raiz['checklists']) as TrelloChecklist[]) {
    const idCartao = texto(c.idCard);
    if (!idCartao) continue;
    const itens = (lista(c.checkItems) as TrelloItemChecklist[])
      .sort((a, b) => numero(a.pos) - numero(b.pos))
      .map((i) => ({
        texto: texto(i.name, 300),
        feito: texto(i.state) === 'complete',
      }))
      .filter((i) => i.texto);
    if (!itens.length) continue;
    checklistPorCartao.set(idCartao, [
      ...(checklistPorCartao.get(idCartao) ?? []),
      ...itens,
    ]);
  }

  // ── membros ──
  const nomePorMembro = new Map<string, string>();
  for (const m of lista(raiz['members']) as TrelloMembro[]) {
    const id = texto(m.id);
    if (id) nomePorMembro.set(id, texto(m.fullName) || texto(m.username) || id);
  }

  // ── comentários (vêm no histórico de ações) ──
  const comentariosPorCartao = new Map<
    string,
    { autor: string; texto: string; data: string }[]
  >();
  for (const a of lista(raiz['actions']) as TrelloAcao[]) {
    if (texto(a.type) !== 'commentCard') continue;
    const dados = (a.data ?? {}) as Record<string, unknown>;
    const cartao = (dados['card'] ?? {}) as Record<string, unknown>;
    const idCartao = texto(cartao['id']);
    const conteudo = texto(dados['text'], 4000);
    if (!idCartao || !conteudo) continue;
    const autorBruto = (a.memberCreator ?? {}) as Record<string, unknown>;
    comentariosPorCartao.set(idCartao, [
      ...(comentariosPorCartao.get(idCartao) ?? []),
      {
        autor:
          texto(autorBruto['fullName']) ||
          texto(autorBruto['username']) ||
          'Trello',
        texto: conteudo,
        data: dataDoTrello(a.date),
      },
    ]);
  }
  // O Trello exporta as ações da mais nova para a mais velha; a conversa precisa ler na
  // ordem em que aconteceu.
  for (const [, itens] of comentariosPorCartao) {
    itens.sort((x, y) => x.data.localeCompare(y.data));
  }

  // ── cartões ──
  const cartoesBrutos = lista(raiz['cards']) as TrelloCartao[];
  const cartoesArquivados = cartoesBrutos.filter((c) =>
    verdade(c.closed),
  ).length;
  const naoMapeadas = new Set<string>();
  let orfaos = 0;

  const cartoes: CartaoImportado[] = cartoesBrutos
    .filter((c) => !verdade(c.closed))
    .filter((c) => {
      // Cartão apontando para uma lista arquivada (ou inexistente) não tem onde cair.
      const ok = idsDeLista.has(texto(c.idList));
      if (!ok) orfaos += 1;
      return ok;
    })
    .map((c) => {
      const etiquetas: string[] = [];
      const semMapa: string[] = [];
      for (const e of lista(c.labels) as TrelloEtiqueta[]) {
        const nome = texto(e.name);
        if (!nome) continue;
        const chave = mapearEtiqueta(nome);
        if (chave) {
          if (!etiquetas.includes(chave)) etiquetas.push(chave);
        } else {
          semMapa.push(nome);
          naoMapeadas.add(nome);
        }
      }
      const idTrello = texto(c.id);
      return {
        idTrello,
        titulo: texto(c.name, 200) || 'Sem título',
        descricao: texto(c.desc, 4000),
        idListaTrello: texto(c.idList),
        ordem: numero(c.pos),
        prazo: dataDoTrello(c.due),
        concluido: verdade(c.dueComplete),
        etiquetas,
        etiquetasNaoMapeadas: semMapa,
        membros: lista(c.idMembers)
          .map((id) => nomePorMembro.get(texto(id)) ?? '')
          .filter(Boolean),
        checklist: checklistPorCartao.get(idTrello) ?? [],
        anexos: (lista(c.attachments) as TrelloAnexo[])
          .map((a) => ({
            nome: texto(a.name, 260) || texto(a.url, 260),
            url: texto(a.url),
            eraArquivo: verdade(a.isUpload),
          }))
          // Só http/https: o campo vem de fora e a tela renderiza como link.
          .filter((a) => /^https?:\/\//i.test(a.url)),
        comentarios: comentariosPorCartao.get(idTrello) ?? [],
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  // ── ressalvas que a pessoa precisa ler ANTES de confirmar ──
  const anexosArquivo = cartoes.reduce(
    (n, c) => n + c.anexos.filter((a) => a.eraArquivo).length,
    0,
  );
  const anexosLink = cartoes.reduce(
    (n, c) => n + c.anexos.filter((a) => !a.eraArquivo).length,
    0,
  );

  if (anexosArquivo) {
    avisos.push(
      `${anexosArquivo} anexo(s) eram ARQUIVOS enviados ao Trello. O JSON traz só o endereço ` +
        'deles, que exige estar logado no Trello para abrir — entram como link. Para tê-los ' +
        'no Painel, baixe do Trello e anexe de novo no cartão.',
    );
  }
  if (naoMapeadas.size) {
    avisos.push(
      `Etiqueta(s) sem correspondência no Painel: ${[...naoMapeadas].join(', ')}. ` +
        'Os cartões vêm sem elas — o Painel tem um catálogo fixo de cinco etiquetas.',
    );
  }
  const comMembros = cartoes.filter((c) => c.membros.length).length;
  if (comMembros) {
    avisos.push(
      `${comMembros} cartão(ões) tinham responsável no Trello. Contas do Trello não têm como ` +
        'virar usuários do Painel nem contatos do SICLA automaticamente: os nomes entram como ' +
        'observação no cartão, e a designação é feita à mão depois.',
    );
  }
  if (orfaos) {
    avisos.push(
      `${orfaos} cartão(ões) estavam em listas arquivadas e ficaram de fora.`,
    );
  }
  if (cartoesArquivados) {
    avisos.push(
      `${cartoesArquivados} cartão(ões) arquivados no Trello não entram — arquivo é histórico.`,
    );
  }

  return {
    nomeQuadro: texto(raiz['name'], 200) || 'Quadro do Trello',
    listas,
    cartoes,
    membros: [...new Set(cartoes.flatMap((c) => c.membros))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    ),
    resumo: {
      listas: listas.length,
      cartoes: cartoes.length,
      cartoesArquivados,
      listasArquivadas: arquivadas,
      checklistItens: cartoes.reduce((n, c) => n + c.checklist.length, 0),
      comentarios: cartoes.reduce((n, c) => n + c.comentarios.length, 0),
      anexosLink,
      anexosArquivo,
      etiquetasNaoMapeadas: [...naoMapeadas],
    },
    avisos,
  };
}
