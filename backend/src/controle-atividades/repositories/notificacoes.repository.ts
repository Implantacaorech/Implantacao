import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AtividadeNotificacao } from '../../database/entities/atividade-notificacao.entity';

/** Persistência da caixa de avisos do módulo. */
@Injectable()
export class NotificacoesRepository {
  constructor(
    @InjectRepository(AtividadeNotificacao)
    private readonly repo: Repository<AtividadeNotificacao>,
  ) {}

  async pendentes(
    usuarioId: number,
    limite = 20,
  ): Promise<AtividadeNotificacao[]> {
    return this.repo.find({
      where: { usuarioId, lida: false },
      order: { criadoEm: 'DESC', id: 'DESC' },
      take: limite,
    });
  }

  async criarVarias(linhas: Partial<AtividadeNotificacao>[]): Promise<void> {
    if (!linhas.length) return;
    await this.repo.save(linhas.map((l) => this.repo.create(l)));
  }

  async marcarLidas(usuarioId: number, ids: number[]): Promise<void> {
    if (!ids.length) return;
    // O `usuarioId` no WHERE não é redundância: sem ele, um id de outra pessoa passado na
    // requisição apagaria o aviso dela.
    await this.repo.update({ id: In(ids), usuarioId }, { lida: true });
  }

  async marcarTodasLidas(usuarioId: number): Promise<void> {
    await this.repo.update({ usuarioId, lida: false }, { lida: true });
  }

  /** Já existe aviso PENDENTE deste tipo para este cartão e esta pessoa?
   *
   * É o que impede o robô de prazos de empilhar um aviso por dia do mesmo cartão vencido —
   * o pop-up fica aberto até ser fechado, então repetir só entulharia a tela. */
  async jaAvisado(
    usuarioId: number,
    cartaoId: number,
    tipo: string,
  ): Promise<boolean> {
    const n = await this.repo.count({
      where: { usuarioId, cartaoId, tipo: tipo as never, lida: false },
    });
    return n > 0;
  }
}
