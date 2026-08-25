import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClienteApi } from '../../database/entities/cliente-api.entity';

/** Persistência dos clientes de máquina da API de Dados. Camada Repository do Guia Mestre
 * de Arquitetura: só fala com o banco — nada de regra, nada de exceção HTTP. */
@Injectable()
export class ClienteApiRepository {
  constructor(
    @InjectRepository(ClienteApi)
    private readonly repo: Repository<ClienteApi>,
  ) {}

  listar(): Promise<ClienteApi[]> {
    return this.repo.find({ order: { nome: 'ASC' } });
  }

  porId(id: number): Promise<ClienteApi | null> {
    return this.repo.findOne({ where: { id } });
  }

  porPrefixo(prefixo: string): Promise<ClienteApi | null> {
    return this.repo.findOne({ where: { prefixo } });
  }

  criar(dados: Partial<ClienteApi>): Promise<ClienteApi> {
    return this.repo.save(this.repo.create(dados));
  }

  salvar(cliente: ClienteApi): Promise<ClienteApi> {
    return this.repo.save(cliente);
  }

  async marcarUso(id: number, quando: Date): Promise<void> {
    await this.repo.update({ id }, { ultimoUsoEm: quando });
  }

  async remover(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
