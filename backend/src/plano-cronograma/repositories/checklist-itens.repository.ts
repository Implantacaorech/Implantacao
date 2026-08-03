import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChecklistItem } from '../../database/entities/checklist-item.entity';

/** Persistência das linhas do Check List. Espelho do `CronogramaItensRepository` — mesmo
 * contrato, mesma razão (ver o comentário de lá sobre `substituir`). */
@Injectable()
export class ChecklistItensRepository {
  constructor(
    @InjectRepository(ChecklistItem)
    private readonly repo: Repository<ChecklistItem>,
  ) {}

  async doProjeto(projetoId: number): Promise<ChecklistItem[]> {
    return this.repo.find({ where: { projetoId }, order: { ordem: 'ASC' } });
  }

  async substituir(
    projetoId: number,
    linhas: Partial<ChecklistItem>[],
  ): Promise<void> {
    await this.repo.delete({ projetoId });
    if (linhas.length === 0) return;
    await this.repo.save(linhas.map((l) => this.repo.create(l)));
  }
}
