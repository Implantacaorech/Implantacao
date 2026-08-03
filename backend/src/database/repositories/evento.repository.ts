import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evento, TipoEvento } from '../entities/evento.entity';

/** Persistência de `Evento` (timeline/auditoria do projeto) — SÓ acesso a dado, sem regra
 * de negócio (Guia Mestre §Responsabilidades → Repository).
 *
 * Transversal como `ProjetoRepository`: 7 módulos gravam evento hoje. Ver
 * [[projeto.repository.ts]] para o critério de onde um repository mora. */
@Injectable()
export class EventoRepository {
  constructor(
    @InjectRepository(Evento)
    private readonly repo: Repository<Evento>,
  ) {}

  async registrar(
    projetoId: number,
    tipo: TipoEvento,
    descricao: string,
    autor: string,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({ projetoId, tipo, descricao, autor: autor || '' }),
    );
  }
}
