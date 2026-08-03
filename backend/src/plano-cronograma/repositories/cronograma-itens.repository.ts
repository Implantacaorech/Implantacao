import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CronogramaItem } from '../../database/entities/cronograma-item.entity';

/** Persistência das linhas do Cronograma. SÓ acesso a dado (Guia Mestre
 * §Responsabilidades → Repository): quem decide o que gravar, calcula o diff e registra o
 * histórico é o `CronogramaItensService`.
 *
 * `substituir` é uma operação de persistência, não regra: o "apaga tudo e reinsere" é o
 * formato de gravação escolhido para esta tabela (herdado de webapp/db.py:salvar_linhas),
 * e mantê-lo aqui evita que o Service conheça `delete`/`create`/`save` do TypeORM. */
@Injectable()
export class CronogramaItensRepository {
  constructor(
    @InjectRepository(CronogramaItem)
    private readonly repo: Repository<CronogramaItem>,
  ) {}

  async doProjeto(projetoId: number): Promise<CronogramaItem[]> {
    return this.repo.find({ where: { projetoId }, order: { ordem: 'ASC' } });
  }

  async substituir(
    projetoId: number,
    linhas: Partial<CronogramaItem>[],
  ): Promise<void> {
    await this.repo.delete({ projetoId });
    if (linhas.length === 0) return;
    await this.repo.save(linhas.map((l) => this.repo.create(l)));
  }
}
