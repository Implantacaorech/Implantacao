import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DicionarioDocumento,
  TipoDicionarioDocumento,
} from '../database/entities/dicionario-documento.entity';
import { SecaoDocumento, parseDocumentoMarkdown } from './markdown-parser';
import { PesquisarDicionarioDto } from './dto/pesquisar-dicionario.dto';

const LIMITE_RESULTADOS = 40;
const TAMANHO_TRECHO = 240;

export interface ResultadoPesquisaDicionario {
  slug: string;
  tipo: TipoDicionarioDocumento;
  sigla: string;
  titulo: string;
  resumo: string;
  trecho: string | null;
  urlOrigem: string;
}

export interface DocumentoDetalhe {
  slug: string;
  tipo: TipoDicionarioDocumento;
  sigla: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  secoes: SecaoDocumento[];
  palavrasChave: string[];
  caminhoOrigem: string;
  urlOrigem: string;
  atualizadoEm: Date;
}

export interface FiltroSigla {
  sigla: string;
  titulo: string;
  tipo: TipoDicionarioDocumento;
}

export interface StatusDicionario {
  totalDocumentos: number;
  totalModulos: number;
  totalAdicionais: number;
  ultimaIngestaoEm: Date | null;
}

const ACENTUADOS = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn';

/** Minúsculas e sem acento, **preservando as posições**: cada caractere de entrada vira
 * exatamente um de saída. Isso importa porque o índice encontrado aqui é usado para recortar
 * o trecho do texto ORIGINAL — um `normalize('NFD')` comum muda o comprimento e desalinharia
 * o recorte em qualquer documento com acento, que é o caso de todos eles. */
function normalizar(texto: string): string {
  let saida = '';
  for (const ch of texto.toLowerCase()) {
    const i = ACENTUADOS.indexOf(ch);
    saida += i === -1 ? ch : SEM_ACENTO[i];
  }
  return saida;
}

/** Palavras que não ajudam a distinguir documento nenhum — se entrassem na pontuação,
 * "nota DE devolução" daria pontos a todo documento que tem "de". */
const PALAVRAS_VAZIAS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'o',
  'a',
  'os',
  'as',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'com',
  'um',
  'uma',
  'que',
  'ao',
  'aos',
]);

/** Quebra a pesquisa em termos buscáveis. É o que faz `nota fiscal devolução` funcionar:
 * antes, a frase inteira precisava aparecer literalmente no texto. */
export function termosDaPesquisa(q: string): string[] {
  const termos = normalizar(q)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !PALAVRAS_VAZIAS.has(t));
  return [...new Set(termos)];
}

/** Peso de cada lugar onde o termo pode aparecer. A ordem é a intuição do usuário: um termo
 * no título ou na sigla diz do que o documento TRATA; no meio do corpo, só que ele é citado. */
const PESO_SIGLA = 100;
const PESO_TITULO = 40;
const PESO_PALAVRAS_CHAVE = 25;
const PESO_RESUMO = 15;
const PESO_CONTEUDO = 5;

/** Quantos termos casaram domina qualquer soma de pesos: um documento que atende 3 dos 3
 * termos pesquisados sempre vem antes de um que atende 2, por melhor que sejam os lugares. */
const BONUS_POR_TERMO_CASADO = 1000;

interface Pontuacao {
  pontos: number;
  /** Termo que casou no lugar mais relevante — é em torno dele que o trecho é recortado. */
  melhorTermo: string | null;
}

function pontuar(d: DicionarioDocumento, termos: string[]): Pontuacao {
  const sigla = normalizar(d.sigla);
  const titulo = normalizar(d.titulo);
  const chaves = normalizar(d.palavrasChave);
  const resumo = normalizar(d.resumo);
  const conteudo = normalizar(d.conteudo);

  let pontos = 0;
  let casados = 0;
  let melhorTermo: string | null = null;
  let melhorPeso = 0;

  for (const termo of termos) {
    let peso = 0;
    if (sigla === termo) peso += PESO_SIGLA;
    if (titulo.includes(termo)) peso += PESO_TITULO;
    if (chaves.includes(termo)) peso += PESO_PALAVRAS_CHAVE;
    if (resumo.includes(termo)) peso += PESO_RESUMO;
    if (conteudo.includes(termo)) peso += PESO_CONTEUDO;

    if (peso === 0) continue;
    casados += 1;
    pontos += peso;
    if (peso > melhorPeso) {
      melhorPeso = peso;
      melhorTermo = termo;
    }
  }

  return {
    pontos: casados === 0 ? 0 : pontos + casados * BONUS_POR_TERMO_CASADO,
    melhorTermo,
  };
}

/** Recorta um trecho do conteúdo em torno da primeira ocorrência do termo. A busca da posição
 * é feita no texto normalizado (para achar `devolucao` em "devolução"), mas o recorte sai do
 * texto ORIGINAL — daí a exigência de a normalização preservar posições. */
function trechoEmTornoDoTermo(conteudo: string, termo: string): string | null {
  const pos = normalizar(conteudo).indexOf(normalizar(termo));
  if (pos === -1) return null;
  const inicio = Math.max(0, pos - TAMANHO_TRECHO / 2);
  const fim = Math.min(
    conteudo.length,
    pos + termo.length + TAMANHO_TRECHO / 2,
  );
  return (
    (inicio > 0 ? '…' : '') +
    conteudo.slice(inicio, fim).replace(/\s+/g, ' ').trim() +
    (fim < conteudo.length ? '…' : '')
  );
}

@Injectable()
export class DicionarioService {
  constructor(
    @InjectRepository(DicionarioDocumento)
    private readonly repo: Repository<DicionarioDocumento>,
  ) {}

  async pesquisar(
    dto: PesquisarDicionarioDto,
  ): Promise<ResultadoPesquisaDicionario[]> {
    const qb = this.repo.createQueryBuilder('d');
    if (dto.tipo) qb.andWhere('d.tipo = :tipo', { tipo: dto.tipo });
    if (dto.sigla)
      qb.andWhere('LOWER(d.sigla) = LOWER(:sigla)', { sigla: dto.sigla });

    const termos = termosDaPesquisa(dto.q ?? '');

    // Sem termo é NAVEGAÇÃO, não busca: devolve o acervo (respeitando os filtros) em ordem
    // alfabética, para a tela poder abrir mostrando os assuntos em vez de uma tela vazia.
    if (termos.length === 0) {
      const registros = await qb
        .orderBy('d.sigla', 'ASC')
        .take(LIMITE_RESULTADOS)
        .getMany();
      return registros.map((d) => this.paraResultado(d, null));
    }

    // O acervo são 87 documentos: filtrar por OR no banco e PONTUAR em memória custa menos
    // do que tentar espremer a relevância em SQL, e deixa a regra de ordenação legível e
    // testável. Se o acervo crescer uma ordem de grandeza, aí sim vale um índice fulltext.
    qb.andWhere(
      `(${termos
        .map(
          (_, i) =>
            `LOWER(d.titulo) LIKE :t${i} OR LOWER(d.resumo) LIKE :t${i} OR ` +
            `LOWER(d.palavrasChave) LIKE :t${i} OR LOWER(d.conteudo) LIKE :t${i} OR ` +
            `LOWER(d.sigla) = :s${i}`,
        )
        .join(' OR ')})`,
      Object.fromEntries(
        termos.flatMap((t, i) => [
          [`t${i}`, `%${t}%`],
          [`s${i}`, t],
        ]),
      ),
    );

    const candidatos = await qb.getMany();

    return candidatos
      .map((d) => ({ d, p: pontuar(d, termos) }))
      .filter(({ p }) => p.pontos > 0)
      .sort(
        (a, b) => b.p.pontos - a.p.pontos || a.d.sigla.localeCompare(b.d.sigla),
      )
      .slice(0, LIMITE_RESULTADOS)
      .map(({ d, p }) => this.paraResultado(d, p.melhorTermo));
  }

  private paraResultado(
    d: DicionarioDocumento,
    termo: string | null,
  ): ResultadoPesquisaDicionario {
    return {
      slug: d.slug,
      tipo: d.tipo,
      sigla: d.sigla,
      titulo: d.titulo,
      resumo: d.resumo,
      trecho: termo ? trechoEmTornoDoTermo(d.conteudo, termo) : null,
      urlOrigem: d.urlOrigem,
    };
  }

  async obter(slug: string): Promise<DocumentoDetalhe> {
    const d = await this.repo.findOne({ where: { slug } });
    if (!d)
      throw new NotFoundException('Documento não encontrado no Dicionário.');
    // Seções são dado derivado — reparseadas do markdown na hora, sem coluna dedicada.
    const secoes = parseDocumentoMarkdown(d.conteudo).secoes;
    return {
      slug: d.slug,
      tipo: d.tipo,
      sigla: d.sigla,
      titulo: d.titulo,
      resumo: d.resumo,
      conteudo: d.conteudo,
      secoes,
      palavrasChave: d.palavrasChave
        ? d.palavrasChave.split(' ').filter(Boolean)
        : [],
      caminhoOrigem: d.caminhoOrigem,
      urlOrigem: d.urlOrigem,
      atualizadoEm: d.atualizadoEm,
    };
  }

  async siglas(): Promise<FiltroSigla[]> {
    const registros = await this.repo.find({
      select: ['sigla', 'titulo', 'tipo'],
      order: { tipo: 'ASC', sigla: 'ASC' },
    });
    return registros.map((d) => ({
      sigla: d.sigla,
      titulo: d.titulo,
      tipo: d.tipo,
    }));
  }

  async status(): Promise<StatusDicionario> {
    const totalDocumentos = await this.repo.count();
    const totalModulos = await this.repo.count({ where: { tipo: 'modulo' } });
    const totalAdicionais = await this.repo.count({
      where: { tipo: 'adicional' },
    });
    const ultimo = await this.repo
      .createQueryBuilder('d')
      .select('MAX(d.atualizadoEm)', 'maximo')
      .getRawOne<{ maximo: Date | null }>();
    return {
      totalDocumentos,
      totalModulos,
      totalAdicionais,
      ultimaIngestaoEm: ultimo?.maximo ?? null,
    };
  }

  /** Recupera os documentos mais relevantes para uma pergunta (recuperação para o RAG):
   * pontua por ocorrência dos termos da pergunta no título/sigla/palavras-chave/conteúdo. */
  async recuperarParaPergunta(
    pergunta: string,
    limite = 4,
  ): Promise<DicionarioDocumento[]> {
    const termos = pergunta
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (termos.length === 0) return [];

    const todos = await this.repo.find();
    const pontuados = todos
      .map((doc) => {
        const alvoTitulo =
          `${doc.titulo} ${doc.sigla} ${doc.palavrasChave}`.toLowerCase();
        const alvoCorpo = doc.conteudo.toLowerCase();
        let score = 0;
        for (const termo of termos) {
          if (alvoTitulo.includes(termo)) score += 5;
          if (alvoCorpo.includes(termo)) score += 1;
        }
        return { doc, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);

    return pontuados.map((p) => p.doc);
  }
}
