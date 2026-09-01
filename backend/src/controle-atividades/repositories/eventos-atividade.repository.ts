import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AtividadeEvento } from '../../database/entities/atividade-evento.entity';

/** Persistência da trilha de auditoria do quadro. */
@Injectable()
export class EventosAtividadeRepository {
  constructor(
    @InjectRepository(AtividadeEvento)
    private readonly repo: Repository<AtividadeEvento>,
  ) {}

  async registrar(dados: Partial<AtividadeEvento>): Promise<void> {
    await this.repo.save(this.repo.create(dados));
  }

  async doQuadro(quadroId: number, limite = 100): Promise<AtividadeEvento[]> {
    return this.repo.find({
      where: { quadroId },
      order: { criadoEm: 'DESC', id: 'DESC' },
      take: limite,
    });
  }
}
