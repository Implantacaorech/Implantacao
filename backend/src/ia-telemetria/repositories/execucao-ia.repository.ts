import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { ExecucaoIa } from '../../database/entities/execucao-ia.entity';

/** Uma linha por finalidade na agregação por finalidade. */
export interface AgregadoFinalidade {
  finalidade: string;
  execucoes: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
}

/** Acesso à tabela `execucoes_ia`. Só persistência e consultas de agregação — a regra de
 * negócio (custo, teto, formatação) mora no service. */
@Injectable()
export class ExecucaoIaRepository {
  constructor(
    @InjectRepository(ExecucaoIa)
    private readonly repo: Repository<ExecucaoIa>,
  ) {}

  async salvar(dados: Partial<ExecucaoIa>): Promise<ExecucaoIa> {
    return this.repo.save(this.repo.create(dados));
  }

  /** Soma do custo estimado desde `desde` (para o teto diário). Ignora linhas de custo nulo. */
  async custoDesde(desde: Date): Promise<number> {
    const { soma } = (await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.custo_usd), 0)', 'soma')
      .where('e.criado_em >= :desde', { desde })
      .getRawOne<{ soma: string | number }>()) ?? { soma: 0 };
    return Number(soma) || 0;
  }

  /** Agregação por finalidade num intervalo. */
  async agregarPorFinalidade(
    desde: Date,
    ate: Date,
  ): Promise<AgregadoFinalidade[]> {
    const linhas = await this.repo
      .createQueryBuilder('e')
      .select('e.finalidade', 'finalidade')
      .addSelect('COUNT(*)', 'execucoes')
      .addSelect('COALESCE(SUM(e.tokens_entrada), 0)', 'tokensEntrada')
      .addSelect('COALESCE(SUM(e.tokens_saida), 0)', 'tokensSaida')
      .addSelect('COALESCE(SUM(e.custo_usd), 0)', 'custoUsd')
      .where('e.criado_em BETWEEN :desde AND :ate', { desde, ate })
      .groupBy('e.finalidade')
      .getRawMany<{
        finalidade: string;
        execucoes: string;
        tokensEntrada: string;
        tokensSaida: string;
        custoUsd: string;
      }>();
    return linhas.map((l) => ({
      finalidade: l.finalidade,
      execucoes: Number(l.execucoes) || 0,
      tokensEntrada: Number(l.tokensEntrada) || 0,
      tokensSaida: Number(l.tokensSaida) || 0,
      custoUsd: Number(l.custoUsd) || 0,
    }));
  }

  /** Total de custo estimado num intervalo. */
  async custoEntre(desde: Date, ate: Date): Promise<number> {
    const { soma } = (await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.custo_usd), 0)', 'soma')
      .where('e.criado_em BETWEEN :desde AND :ate', { desde, ate })
      .getRawOne<{ soma: string | number }>()) ?? { soma: 0 };
    return Number(soma) || 0;
  }

  /** Contagem de erros num intervalo. */
  async errosDesde(desde: Date): Promise<number> {
    return this.repo.count({
      where: { status: 'erro', criadoEm: MoreThanOrEqual(desde) },
    });
  }

  /** Últimas N execuções (para a lista da tela). */
  async ultimas(limite: number): Promise<ExecucaoIa[]> {
    return this.repo.find({
      order: { criadoEm: 'DESC' },
      take: limite,
    });
  }

  /** Total de execuções num intervalo. */
  async contarEntre(desde: Date, ate: Date): Promise<number> {
    return this.repo.count({ where: { criadoEm: Between(desde, ate) } });
  }
}
