import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { EmailPasso } from '../../database/entities/email-passo.entity';
import { Protocolo } from '../../database/entities/protocolo.entity';
import { STATUS_EM_PROCESSAMENTO } from '../../protocolos/protocolos.constants';

/** O que o diagnóstico precisa ler do banco. Mantido num repository próprio (e não
 * espalhado pelos services dos outros módulos) porque a pergunta aqui é sempre a mesma —
 * "isto está falhando em silêncio?" —, e nenhuma das consultas pertence ao fluxo de negócio
 * de quem é dono da tabela. */
@Injectable()
export class SaudeBancoRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(EmailPasso)
    private readonly emails: Repository<EmailPasso>,
    @InjectRepository(Protocolo)
    private readonly protocolos: Repository<Protocolo>,
  ) {}

  /** Prova que a CONEXÃO responde. `DataSource` cru de propósito, sem repository de
   * entidade — mesmo motivo do HealthService: um schema específico não pode fazer o
   * diagnóstico do banco falhar. */
  async conexaoResponde(): Promise<{
    ok: boolean;
    dialeto: string;
    erro: string;
  }> {
    const dialeto = this.dataSource.options.type;
    try {
      await this.dataSource.query('SELECT 1');
      return { ok: true, dialeto, erro: '' };
    } catch (e) {
      return {
        ok: false,
        dialeto,
        erro: e instanceof Error ? e.message : String(e),
      };
    }
  }

  /** E-mails de passo que falharam desde `desde`. Eles JÁ ficam gravados (a entidade guarda
   * o que não saiu, de propósito), mas ninguém era avisado: só apareciam para quem abrisse
   * o passo daquele projeto. */
  async emailsQueFalharam(
    desde: Date,
  ): Promise<{ total: number; ultimoErro: string }> {
    const falhos = await this.emails.find({
      where: { status: 'falhou', criadoEm: MoreThanOrEqual(desde) },
      order: { criadoEm: 'DESC' },
      take: 20,
    });
    return {
      total: falhos.length,
      ultimoErro: (falhos[0]?.erro ?? '').slice(0, 200),
    };
  }

  /** Protocolos parados em 'Transcrevendo'/'Analisando'. Devolve o registro inteiro porque
   * o Service ainda vai perguntar ao docservice se o trabalho existe de verdade. */
  async protocolosEmProcessamento(): Promise<Protocolo[]> {
    return this.protocolos.find({
      where: STATUS_EM_PROCESSAMENTO.map((status) => ({ status })),
      order: { criadoEm: 'ASC' },
    });
  }
}
