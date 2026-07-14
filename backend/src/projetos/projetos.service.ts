import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { UpdateProjetoDto } from './dto/update-projeto.dto';
import { ListarProjetosDto } from './dto/listar-projetos.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_VEEM_TODOS_PROJETOS } from '../common/constants/perfis';

export interface Paginado<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

@Injectable()
export class ProjetosService {
  constructor(
    @InjectRepository(Projeto) private readonly repo: Repository<Projeto>,
  ) {}

  /** Equivalente a _so_meus() do Flask: ADM/Coordenador/Administrativo veem tudo; GCI só onde
   * é GCI; Consultor só onde é consultor designado. */
  async listar(
    filtro: ListarProjetosDto,
    user: AuthUser,
  ): Promise<Paginado<Projeto>> {
    const qb = this.repo
      .createQueryBuilder('p')
      .orderBy('p.atualizadoEm', 'DESC');

    if (filtro.cliente) {
      qb.andWhere('LOWER(p.cliente) LIKE LOWER(:cliente)', {
        cliente: `%${filtro.cliente}%`,
      });
    }
    if (filtro.etapa) {
      qb.andWhere('p.etapa = :etapa', { etapa: filtro.etapa });
    }
    if (!PERFIS_VEEM_TODOS_PROJETOS.includes(user.perfil)) {
      if (user.perfil === 'GCI') {
        qb.andWhere('p.gci = :nome', { nome: user.nome });
      } else {
        qb.andWhere('p.consultor = :nome', { nome: user.nome });
      }
    }

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((filtro.page - 1) * filtro.limit)
      .take(filtro.limit)
      .getMany();

    return {
      data,
      pagination: {
        page: filtro.page,
        limit: filtro.limit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / filtro.limit)),
      },
    };
  }

  async buscarPorId(id: number): Promise<Projeto> {
    const projeto = await this.repo.findOne({ where: { id } });
    if (!projeto) throw new NotFoundException('Projeto não encontrado');
    return projeto;
  }

  async criar(dto: CreateProjetoDto): Promise<Projeto> {
    const projeto = this.repo.create(dto);
    return this.repo.save(projeto);
  }

  async atualizar(id: number, dto: UpdateProjetoDto): Promise<Projeto> {
    const projeto = await this.buscarPorId(id);
    Object.assign(projeto, dto);
    return this.repo.save(projeto);
  }

  async excluir(id: number): Promise<void> {
    const projeto = await this.buscarPorId(id);
    await this.repo.remove(projeto);
  }
}
