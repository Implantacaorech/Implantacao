import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AtividadeLista } from '../../database/entities/atividade-lista.entity';

/** Persistência das colunas do quadro. */
@Injectable()
export class ListasRepository {
  constructor(
    @InjectRepository(AtividadeLista)
    private readonly repo: Repository<AtividadeLista>,
  ) {}

  async doQuadro(quadroId: number): Promise<AtividadeLista[]> {
    return this.repo.find({
      where: { quadroId, arquivada: false },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async dosQuadros(quadroIds: number[]): Promise<AtividadeLista[]> {
    if (!quadroIds.length) return [];
    return this.repo.find({
      where: { quadroId: In(quadroIds), arquivada: false },
      order: { ordem: 'ASC', id: 'ASC' },
    });
  }

  async porId(id: number): Promise<AtividadeLista | null> {
    return this.repo.findOne({ where: { id } });
  }

  async criar(dados: Partial<AtividadeLista>): Promise<AtividadeLista> {
    return this.repo.save(this.repo.create(dados));
  }

  async salvar(lista: AtividadeLista): Promise<AtividadeLista> {
    return this.repo.save(lista);
  }

  async criarVarias(
    linhas: Partial<AtividadeLista>[],
  ): Promise<AtividadeLista[]> {
    if (!linhas.length) return [];
    return this.repo.save(linhas.map((l) => this.repo.create(l)));
  }
}
