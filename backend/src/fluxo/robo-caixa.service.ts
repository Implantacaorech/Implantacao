import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/configuration';
import { ImapIntakeService } from './imap-intake.service';
import { FluxoService } from './fluxo.service';

const NOME_INTERVALO = 'robo-caixa';

/** Robô: a cada `imapPollMin` minutos (piso de 2 min), varre a caixa de entrada e cria
 * projetos a partir dos e-mails de fechamento não lidos. Espelha
 * webapp/app.py:_agendador_caixa() — mesmo padrão de `RoboProtocolosService` (setInterval
 * via SchedulerRegistry em vez de `while True: sleep()`, pulado em teste). */
@Injectable()
export class RoboCaixaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RoboCaixaService');

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly imap: ImapIntakeService,
    private readonly fluxo: FluxoService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const mins = this.config.get('imapPollMin', { infer: true });
    const ms = Math.max(120, mins * 60) * 1000;
    const intervalo = setInterval(() => {
      void this.tick();
    }, ms);
    this.scheduler.addInterval(NOME_INTERVALO, intervalo);
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist('interval', NOME_INTERVALO)) {
      this.scheduler.deleteInterval(NOME_INTERVALO);
    }
  }

  async tick(): Promise<void> {
    try {
      if (this.imap.configurado()) {
        const n = await this.imap.processarFechamentos((corpo, assunto) =>
          this.fluxo.criarDeFechamento(corpo, assunto).then(() => undefined),
        );
        if (n) this.logger.log(`Robô da caixa: ${n} fechamento(s) processado(s).`);
      }
    } catch (e) {
      this.logger.error('Robô da caixa falhou', e instanceof Error ? e.stack : String(e));
    }
  }
}
