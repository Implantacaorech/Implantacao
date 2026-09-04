import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { PresencaSessao } from '../../database/entities/presenca-sessao.entity';

/** Persistência da presença. Camada Repository do ADR-0002: só banco. */
@Injectable()
export class PresencaRepository {
  constructor(
    @InjectRepository(PresencaSessao)
    private readonly repo: Repository<PresencaSessao>,
  ) {}

  async porUsuarioSessao(
    usuarioId: number,
    sessao: string,
  ): Promise<PresencaSessao | null> {
    return this.repo.findOne({ where: { usuarioId, sessao } });
  }

  async salvar(linha: Partial<PresencaSessao>): Promise<PresencaSessao> {
    return this.repo.save(this.repo.create(linha));
  }

  /** Sessões com batida a partir de `desde` — as que contam como online. */
  async ativasDesde(desde: Date): Promise<PresencaSessao[]> {
    return this.repo.find({
      where: { ultimoPing: MoreThanOrEqual(desde) },
      order: { ultimoPing: 'DESC' },
    });
  }

  async remover(usuarioId: number, sessao: string): Promise<void> {
    await this.repo.delete({ usuarioId, sessao });
  }

  /** Poda as sessões frias DESTE usuário. Chamada na batida dele, o que mantém a tabela
   * pequena sem precisar de robô: quem está usando limpa o próprio rastro antigo. */
  async podarDoUsuario(usuarioId: number, anteriorA: Date): Promise<void> {
    await this.repo.delete({ usuarioId, ultimoPing: LessThan(anteriorA) });
  }

  /** Poda geral — para quem parou de usar e não bate mais. */
  async podarTudo(anteriorA: Date): Promise<void> {
    await this.repo.delete({ ultimoPing: LessThan(anteriorA) });
  }
}
