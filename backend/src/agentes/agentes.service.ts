import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgenteExecucao } from '../database/entities/agente-execucao.entity';
import { IniciarExecucaoDto } from './dto/iniciar-execucao.dto';
import { ConcluirExecucaoDto } from './dto/concluir-execucao.dto';
import { NOS_AGENTES, ARESTAS_AGENTES } from './grafo-agentes.const';

export interface NoGrafoComStatus {
  id: string;
  categoria: 'negocio' | 'software';
  rotulo: string;
  ativo: boolean;
  execucoes24h: number;
}

@Injectable()
export class AgentesService {
  constructor(
    @InjectRepository(AgenteExecucao)
    private readonly repo: Repository<AgenteExecucao>,
  ) {}

  async iniciar(dto: IniciarExecucaoDto): Promise<AgenteExecucao> {
    const execucao = this.repo.create({
      agente: dto.agente,
      tarefa: dto.tarefa ?? '',
      agentePaiId: dto.agentePaiId ?? null,
      status: 'em_execucao',
    });
    return this.repo.save(execucao);
  }

  async concluir(id: number, dto: ConcluirExecucaoDto): Promise<AgenteExecucao> {
    const execucao = await this.repo.findOne({ where: { id } });
    if (!execucao) throw new NotFoundException('Execução não encontrada.');
    execucao.status = dto.status;
    execucao.resultado = dto.resultado ?? null;
    execucao.concluidoEm = new Date();
    return this.repo.save(execucao);
  }

  async listar(ativos: boolean, limite: number): Promise<AgenteExecucao[]> {
    const where = ativos ? { status: 'em_execucao' as const } : {};
    return this.repo.find({
      where,
      order: { iniciadoEm: 'DESC' },
      take: Math.min(Math.max(limite, 1), 200),
    });
  }

  /** Topologia estática (`.claude/agents/`) + status real vindo do banco — nunca dado
   * inventado: `ativo`/`execucoes24h` só refletem linhas que agentes de verdade gravaram. */
  async grafo(): Promise<{ nos: NoGrafoComStatus[]; arestas: typeof ARESTAS_AGENTES }> {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentes = await this.repo
      .createQueryBuilder('e')
      .select('e.agente', 'agente')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN e.status = 'em_execucao' THEN 1 ELSE 0 END)",
        'ativos',
      )
      .where('e.iniciadoEm >= :desde', { desde })
      .groupBy('e.agente')
      .getRawMany<{ agente: string; total: string; ativos: string }>();

    const porAgente = new Map(recentes.map((r) => [r.agente, r]));

    const nos: NoGrafoComStatus[] = NOS_AGENTES.map((n) => {
      const r = porAgente.get(n.id);
      return {
        ...n,
        ativo: Number(r?.ativos ?? 0) > 0,
        execucoes24h: Number(r?.total ?? 0),
      };
    });

    return { nos, arestas: ARESTAS_AGENTES };
  }
}
