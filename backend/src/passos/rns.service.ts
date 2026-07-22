import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjetoRns, TipoRns } from '../database/entities/projeto-rns.entity';

export interface EntradaRns {
  tipo: TipoRns;
  numero?: string;
  descricao?: string;
  situacao?: string;
}

/** RNS vinculadas ao projeto (passo 7). A quantidade é variável de propósito: o
 * Administrativo acrescenta quantos registros o cliente exigir — não há número fixo de RNS
 * por implantação. */
@Injectable()
export class RnsService {
  constructor(
    @InjectRepository(ProjetoRns)
    private readonly rns: Repository<ProjetoRns>,
  ) {}

  listar(projetoId: number): Promise<ProjetoRns[]> {
    return this.rns.find({
      where: { projetoId },
      order: { tipo: 'ASC', id: 'ASC' },
    });
  }

  async acrescentar(
    projetoId: number,
    entrada: EntradaRns,
  ): Promise<ProjetoRns> {
    return this.rns.save(
      this.rns.create({
        projetoId,
        tipo: entrada.tipo,
        numero: (entrada.numero ?? '').trim(),
        descricao: (entrada.descricao ?? '').trim(),
        situacao: (entrada.situacao ?? '').trim(),
      }),
    );
  }

  async atualizar(
    projetoId: number,
    id: number,
    entrada: Partial<EntradaRns>,
  ): Promise<ProjetoRns> {
    const atual = await this.rns.findOne({ where: { id, projetoId } });
    if (!atual) throw new NotFoundException('RNS não encontrada.');
    if (entrada.tipo !== undefined) atual.tipo = entrada.tipo;
    if (entrada.numero !== undefined) atual.numero = entrada.numero.trim();
    if (entrada.descricao !== undefined)
      atual.descricao = entrada.descricao.trim();
    if (entrada.situacao !== undefined)
      atual.situacao = entrada.situacao.trim();
    return this.rns.save(atual);
  }

  async remover(projetoId: number, id: number): Promise<void> {
    const atual = await this.rns.findOne({ where: { id, projetoId } });
    if (!atual) throw new NotFoundException('RNS não encontrada.');
    await this.rns.delete({ id, projetoId });
  }
}
