import { Injectable } from '@nestjs/common';
import {
  Modificacao,
  EntidadeModificacao,
} from '../database/entities/modificacao.entity';
import { ModificacoesRepository } from './repositories/modificacoes.repository';

/** Histórico de modificações linha-a-linha do Cronograma/Check List. Espelha
 * webapp/db.py:registrar_modificacao/modificacoes_do_projeto.
 *
 * O `limite` padrão de 200 e o `autor || ''` são decisões de negócio e por isso ficam
 * aqui, não no repository (Guia Mestre §Responsabilidades). */
@Injectable()
export class ModificacoesService {
  constructor(private readonly repo: ModificacoesRepository) {}

  async doProjeto(
    projetoId: number,
    entidade?: EntidadeModificacao,
    limite = 200,
  ): Promise<Modificacao[]> {
    return this.repo.doProjeto(projetoId, entidade, limite);
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
    await this.repo.registrar({
      projetoId,
      entidade,
      ref,
      campo,
      de,
      para,
      autor: autor || '',
    });
  }
}
