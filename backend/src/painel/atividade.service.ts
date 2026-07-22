import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { soMeus } from '../common/utils/so-meus.util';
import {
  FaseFunil,
  MetricasService,
  MetricasUso,
} from '../metricas/metricas.service';

export interface ItemFeedAtividade {
  id: number;
  projetoId: number;
  tipo: string;
  descricao: string;
  autor: string;
  criadoEm: Date;
  cliente: string;
}

export interface PainelAtividade {
  feed: ItemFeedAtividade[];
  uso: MetricasUso;
  funil: FaseFunil[];
}

/** Atividade da operação: uso dos últimos 30 dias (projetos novos, documentos, e-mails,
 * transições de etapa) + funil por macro-fase com idade média + feed cronológico dos
 * últimos 60 eventos. Espelha webapp/routes_painel.py:atividade. */
@Injectable()
export class AtividadeService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Evento) private readonly eventosRepo: Repository<Evento>,
    private readonly metricas: MetricasService,
  ) {}

  async painel(user: AuthUser): Promise<PainelAtividade> {
    const todos = await this.projetos.find();
    const meus = soMeus(todos, user);
    const ids = meus.map((p) => p.id);
    const cliPorId = new Map(meus.map((p) => [p.id, p.cliente]));

    const eventos =
      ids.length > 0
        ? await this.eventosRepo.find({
            where: { projetoId: In(ids) },
            order: { criadoEm: 'DESC' },
          })
        : [];

    const feed: ItemFeedAtividade[] = eventos
      .slice(0, 60)
      .map((e) => ({ ...e, cliente: cliPorId.get(e.projetoId) ?? '?' }));

    return {
      feed,
      uso: this.metricas.metricasUso(eventos, meus),
      funil: this.metricas.funilMacro(meus),
    };
  }
}
