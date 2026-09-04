import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { hojeIso } from '../cronograma/datas.util';
import { QuadrosRepository } from './repositories/quadros.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { NotificacoesRepository } from './repositories/notificacoes.repository';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';

const NOME_INTERVALO = 'robo-prazos-atividades';
const CHECAGEM_MS = 60 * 60 * 1000; // de hora em hora; o aviso em si é no máximo 1 por dia
const HORA_AVISO = 8;

/** Avisa os responsáveis dos cartões com prazo VENCIDO (decisão 4 do usuário, 2026-09-01).
 *
 * Mesmo padrão de `RoboDigestService`: `setInterval` registrado no `SchedulerRegistry`, e
 * pulado em teste (`NODE_ENV=test`).
 *
 * O aviso não se repete todo dia para o mesmo cartão: `jaAvisado` só cria a notificação se
 * não houver uma PENDENTE do mesmo tipo. Como o pop-up fica aberto até a pessoa fechar,
 * repetir só entulharia a tela — e quem fechou já sabe do atraso. */
@Injectable()
export class RoboPrazosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RoboPrazosService');
  private ultimaVarredura: string | null = null;

  constructor(
    private readonly quadros: QuadrosRepository,
    private readonly cartoes: CartoesRepository,
    private readonly notificacoes: NotificacoesRepository,
    private readonly avisos: NotificacoesAtividadeService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const intervalo = setInterval(() => {
      void this.tick();
    }, CHECAGEM_MS);
    this.scheduler.addInterval(NOME_INTERVALO, intervalo);
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist('interval', NOME_INTERVALO)) {
      this.scheduler.deleteInterval(NOME_INTERVALO);
    }
  }

  async tick(): Promise<void> {
    const hoje = hojeIso();
    if (new Date().getHours() !== HORA_AVISO || this.ultimaVarredura === hoje) {
      return;
    }
    this.ultimaVarredura = hoje;
    try {
      await this.varrer(hoje);
    } catch (e) {
      this.logger.warn(`Varredura de prazos falhou: ${(e as Error).message}`);
    }
  }

  /** Um aviso por cartão vencido, para cada responsável do quadro. */
  async varrer(hoje: string): Promise<number> {
    const quadros = await this.quadros.listar();
    let avisados = 0;
    for (const quadro of quadros) {
      const cartoes = await this.cartoes.doQuadro(quadro.id, false);
      const vencidos = cartoes.filter(
        (c) => c.prazo && !c.concluidoEm && c.prazo < hoje,
      );
      if (!vencidos.length) continue;
      const responsaveis = await this.avisos.responsaveisDo(quadro.id);
      for (const cartao of vencidos) {
        for (const usuarioId of responsaveis) {
          if (
            await this.notificacoes.jaAvisado(usuarioId, cartao.id, 'prazo')
          ) {
            continue;
          }
          await this.avisos.avisar(
            quadro,
            cartao,
            'prazo',
            'Prazo vencido',
            `"${cartao.titulo}" venceu em ${cartao.prazo} — ${quadro.nomeCliente}.`,
            [usuarioId],
          );
          avisados += 1;
        }
      }
    }
    return avisados;
  }
}
