import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AtividadeQuadro } from '../../database/entities/atividade-quadro.entity';
import { AtividadeQuadroResponsavel } from '../../database/entities/atividade-quadro-responsavel.entity';

/** Persistência dos quadros e de quem responde por eles. Camada Repository do ADR-0002:
 * só banco — nada de regra, nada de exceção HTTP. */
@Injectable()
export class QuadrosRepository {
  constructor(
    @InjectRepository(AtividadeQuadro)
    private readonly repo: Repository<AtividadeQuadro>,
    @InjectRepository(AtividadeQuadroResponsavel)
    private readonly resp: Repository<AtividadeQuadroResponsavel>,
  ) {}

  async listar(): Promise<AtividadeQuadro[]> {
    return this.repo.find({
      where: { arquivado: false },
      order: { nomeCliente: 'ASC' },
    });
  }

  async porCodigo(codigo: string): Promise<AtividadeQuadro | null> {
    return this.repo.findOne({ where: { codigoClienteSicla: codigo } });
  }

  async porId(id: number): Promise<AtividadeQuadro | null> {
    return this.repo.findOne({ where: { id } });
  }

  async criar(dados: Partial<AtividadeQuadro>): Promise<AtividadeQuadro> {
    return this.repo.save(this.repo.create(dados));
  }

  async salvar(quadro: AtividadeQuadro): Promise<AtividadeQuadro> {
    return this.repo.save(quadro);
  }

  // --- responsáveis ---

  async responsaveis(
    quadroIds: number[],
  ): Promise<AtividadeQuadroResponsavel[]> {
    if (!quadroIds.length) return [];
    return this.resp.find({ where: { quadroId: In(quadroIds) } });
  }

  async ehResponsavel(quadroId: number, usuarioId: number): Promise<boolean> {
    const n = await this.resp.count({ where: { quadroId, usuarioId } });
    return n > 0;
  }

  async incluirResponsavel(
    quadroId: number,
    usuarioId: number,
    principal = false,
  ): Promise<void> {
    const ja = await this.resp.findOne({ where: { quadroId, usuarioId } });
    if (ja) return;
    await this.resp.save(this.resp.create({ quadroId, usuarioId, principal }));
  }

  async removerResponsavel(quadroId: number, usuarioId: number): Promise<void> {
    await this.resp.delete({ quadroId, usuarioId });
  }

  async contarResponsaveis(quadroId: number): Promise<number> {
    return this.resp.count({ where: { quadroId } });
  }
}
