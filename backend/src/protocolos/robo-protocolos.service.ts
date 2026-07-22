import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/configuration';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';

const NOME_INTERVALO = 'robo-protocolos';

/** Robô: a cada `protocolosPollMin` minutos (piso de 2 min mesmo se configurado menor),
 * registra e processa os vídeos novos da pasta 'Videos Pendentes'. Espelha
 * webapp/protocolos.py:agendador() — o `while True: ... sleep(...)` vira um
 * `setInterval` registrado via `SchedulerRegistry` (o intervalo é configurável em
 * runtime, então `@Interval()` estático não serve). Pulado em teste (`NODE_ENV=test`),
 * mesmo padrão dos seeds de catálogo — não queremos varrer uma pasta real durante os
 * testes. */
@Injectable()
export class RoboProtocolosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RoboProtocolosService');

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly processamento: ProcessamentoProtocolosService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const mins = this.config.get('protocolosPollMin', { infer: true });
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
      if (this.processamento.configurado()) {
        const n = await this.processamento.processarPendentes();
        if (n)
          this.logger.log(`Robô de protocolos: ${n} vídeo(s) processado(s).`);
      }
    } catch (e) {
      this.logger.error(
        'Robô de protocolos falhou',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
