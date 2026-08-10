import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Verificação de saúde do processo. O `SELECT 1` mora aqui, não no controller: mesmo sendo
 * uma linha, é acesso a banco — e a camada de entrada não acessa banco (Guia Mestre
 * §Responsabilidades).
 *
 * Usa `DataSource` cru de propósito, sem repository: o que se quer provar é que a CONEXÃO
 * responde, não que uma tabela existe. Um repository de entidade acoplaria o healthcheck a
 * um schema específico — se a tabela mudasse, o guardião passaria a reiniciar um painel
 * saudável. */
@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async verificar(): Promise<{ status: 'ok'; db: string }> {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', db: this.dataSource.options.type };
  }
}
