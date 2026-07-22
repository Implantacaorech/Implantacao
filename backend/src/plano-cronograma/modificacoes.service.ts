import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Modificacao,
  EntidadeModificacao,
} from '../database/entities/modificacao.entity';

/** Histórico de modificações linha-a-linha do Cronograma/Check List. Espelha
 * webapp/db.py:registrar_modificacao/modificacoes_do_projeto. */
@Injectable()
export class ModificacoesService {
  constructor(
    @InjectRepository(Modificacao)
    private readonly repo: Repository<Modificacao>,
  ) {}

  async doProjeto(
    projetoId: number,
    entidade?: EntidadeModificacao,
    limite = 200,
  ): Promise<Modificacao[]> {
    const where = entidade ? { projetoId, entidade } : { projetoId };
    return this.repo.find({ where, order: { criadoEm: 'DESC' }, take: limite });
  }

  async registrar(
    projetoId: number,
    entidade: EntidadeModificacao,
    ref: string,
    campo: string,
    de: string,
    para: string,
    autor: string,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        projetoId,
        entidade,
        ref,
        campo,
        de,
        para,
        autor: autor || '',
      }),
    );
  }
}
