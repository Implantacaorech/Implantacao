import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenApiDados } from '../../../database/entities/token-api-dados.entity';

/** Persistência dos tokens com que o Painel consulta o Portal API. Camada Repository do
 * Guia Mestre (ADR-0002), irmã de `ClienteApiRepository`: só fala com o banco — nada de
 * regra, nada de exceção HTTP. */
@Injectable()
export class TokenApiDadosRepository {
  constructor(
    @InjectRepository(TokenApiDados)
    private readonly repo: Repository<TokenApiDados>,
  ) {}

  listar(): Promise<TokenApiDados[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  ativos(): Promise<TokenApiDados[]> {
    return this.repo.find({ where: { ativo: true }, order: { id: 'ASC' } });
  }

  porId(id: number): Promise<TokenApiDados | null> {
    return this.repo.findOne({ where: { id } });
  }

  criar(dados: Partial<TokenApiDados>): Promise<TokenApiDados> {
    return this.repo.save(this.repo.create(dados));
  }

  salvar(token: TokenApiDados): Promise<TokenApiDados> {
    return this.repo.save(token);
  }

  async registrarUso(
    id: number,
    quando: Date,
    erro: string | null,
  ): Promise<void> {
    await this.repo.update({ id }, { ultimoUsoEm: quando, ultimoErro: erro });
  }

  async remover(id: number): Promise<void> {
    await this.repo.delete({ id });
  }
}
