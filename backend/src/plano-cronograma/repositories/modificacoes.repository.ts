import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EntidadeModificacao,
  Modificacao,
} from '../../database/entities/modificacao.entity';

/** Persistência do histórico de modificações linha-a-linha do Cronograma/Check List. */
@Injectable()
export class ModificacoesRepository {
  constructor(
    @InjectRepository(Modificacao)
    private readonly repo: Repository<Modificacao>,
  ) {}

  async doProjeto(
    projetoId: number,
    entidade: EntidadeModificacao | undefined,
    limite: number,
  ): Promise<Modificacao[]> {
    const where = entidade ? { projetoId, entidade } : { projetoId };
    return this.repo.find({ where, order: { criadoEm: 'DESC' }, take: limite });
  }

  async registrar(dados: Partial<Modificacao>): Promise<void> {
    await this.repo.save(this.repo.create(dados));
  }
}
