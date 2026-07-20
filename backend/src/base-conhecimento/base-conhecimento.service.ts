import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SigerFonte } from '../database/entities/siger-fonte.entity';

const TAMANHO_TRECHO = 220;
const LIMITE_RESULTADOS = 50;

export interface ResultadoBuscaSiger {
  id: number;
  caminho: string;
  extensao: string;
  pastaRaiz: string;
  tamanhoBytes: number;
  modificadoEm: Date;
  trecho: string | null;
}

export interface StatusBaseConhecimentoSiger {
  totalIndexado: number;
  totalComConteudo: number;
  ultimaImportacaoEm: Date | null;
}

/** Recorta um trecho do conteúdo em torno da primeira ocorrência do termo, para exibir como
 * preview do resultado (mesma ideia de um snippet de motor de busca). */
function extrairTrecho(conteudo: string | null, termo: string): string | null {
  if (!conteudo) return null;
  const posicao = conteudo.toLowerCase().indexOf(termo.toLowerCase());
  if (posicao === -1) return conteudo.slice(0, TAMANHO_TRECHO);
  const inicio = Math.max(0, posicao - TAMANHO_TRECHO / 2);
  const fim = Math.min(conteudo.length, posicao + termo.length + TAMANHO_TRECHO / 2);
  const prefixo = inicio > 0 ? '…' : '';
  const sufixo = fim < conteudo.length ? '…' : '';
  return prefixo + conteudo.slice(inicio, fim) + sufixo;
}

@Injectable()
export class BaseConhecimentoService {
  constructor(
    @InjectRepository(SigerFonte)
    private readonly repo: Repository<SigerFonte>,
  ) {}

  async pesquisar(termo: string): Promise<ResultadoBuscaSiger[]> {
    const registros = await this.repo
      .createQueryBuilder('f')
      .where('LOWER(f.caminho) LIKE LOWER(:termo)', { termo: `%${termo}%` })
      .orWhere('LOWER(f.conteudo) LIKE LOWER(:termo)', { termo: `%${termo}%` })
      .orderBy('f.modificadoEm', 'DESC')
      .take(LIMITE_RESULTADOS)
      .getMany();

    return registros.map((f) => ({
      id: f.id,
      caminho: f.caminho,
      extensao: f.extensao,
      pastaRaiz: f.pastaRaiz,
      tamanhoBytes: f.tamanhoBytes,
      modificadoEm: f.modificadoEm,
      trecho: extrairTrecho(f.conteudo, termo),
    }));
  }

  async status(): Promise<StatusBaseConhecimentoSiger> {
    const totalIndexado = await this.repo.count();
    const totalComConteudo = await this.repo
      .createQueryBuilder('f')
      .where('f.conteudo IS NOT NULL')
      .getCount();
    const ultimo = await this.repo
      .createQueryBuilder('f')
      .select('MAX(f.indexadoEm)', 'maximo')
      .getRawOne<{ maximo: Date | null }>();

    return {
      totalIndexado,
      totalComConteudo,
      ultimaImportacaoEm: ultimo?.maximo ?? null,
    };
  }
}
