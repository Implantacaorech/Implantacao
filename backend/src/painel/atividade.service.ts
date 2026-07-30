import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
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
 * últimos 60 eventos. Espelha webapp/routes_painel.py:atividade.
 *
 * ESCOPO (correção de 2026-07-28): carteira INTEIRA, igual à Coordenação — o gate é o menu
 * `atividade` do painel de Permissões, não mais o filtro por designação (que devolvia feed
 * e funil vazios pra quem tinha o menu liberado e não é ADM/Coordenador/Administrativo). */
@Injectable()
export class AtividadeService {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Evento) private readonly eventosRepo: Repository<Evento>,
    private readonly metricas: MetricasService,
  ) {}

  async painel(): Promise<PainelAtividade> {
    const todos = await this.projetos.find();
    const ids = todos.map((p) => p.id);
    const cliPorId = new Map(todos.map((p) => [p.id, p.cliente]));

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
      uso: this.metricas.metricasUso(eventos, todos),
      funil: this.metricas.funilMacro(todos),
    };
  }
}
