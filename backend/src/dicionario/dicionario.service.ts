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

function trechoEmTornoDoTermo(conteudo: string, termo: string): string | null {
  const pos = conteudo.toLowerCase().indexOf(termo.toLowerCase());
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

    const termo = dto.q?.trim();
    if (termo) {
      qb.andWhere(
        '(LOWER(d.titulo) LIKE LOWER(:t) OR LOWER(d.resumo) LIKE LOWER(:t) OR ' +
          'LOWER(d.palavrasChave) LIKE LOWER(:t) OR LOWER(d.conteudo) LIKE LOWER(:t))',
        { t: `%${termo}%` },
      );
    }
    if (dto.tipo) qb.andWhere('d.tipo = :tipo', { tipo: dto.tipo });
    if (dto.sigla)
      qb.andWhere('LOWER(d.sigla) = LOWER(:sigla)', { sigla: dto.sigla });

    const registros = await qb
      .orderBy('d.sigla', 'ASC')
      .take(LIMITE_RESULTADOS)
      .getMany();

    return registros.map((d) => ({
      slug: d.slug,
      tipo: d.tipo,
      sigla: d.sigla,
      titulo: d.titulo,
      resumo: d.resumo,
      trecho: termo ? trechoEmTornoDoTermo(d.conteudo, termo) : null,
      urlOrigem: d.urlOrigem,
    }));
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
