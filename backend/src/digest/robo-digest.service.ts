import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/configuration';
import { DigestService } from './digest.service';

const NOME_INTERVALO = 'robo-digest';
const CHECAGEM_MS = 30 * 60 * 1000; // checa a cada 30min — mesmo `time.sleep(1800)` do Flask

/** Envia o resumo diário na hora `digestHora` (default 8h), uma vez por dia. Espelha
 * webapp/app.py:_agendador_digest — o `while True: ... sleep(1800)` vira um
 * `setInterval` registrado via `SchedulerRegistry` (mesmo padrão de
 * `RoboProtocolosService`/`RoboCaixaService`). Pulado em teste (`NODE_ENV=test`). */
@Injectable()
export class RoboDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RoboDigestService');
  private ultimoEnvio: string | null = null; // "AAAA-MM-DD" do último dia já enviado

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly digest: DigestService,
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
    try {
      const hora = this.config.get('digestHora', { infer: true });
      const agora = new Date();
      const hojeIso = agora.toISOString().slice(0, 10);
      if (agora.getHours() === hora && this.ultimoEnvio !== hojeIso && this.digest.destinos().length > 0) {
        const r = await this.digest.enviar();
        this.ultimoEnvio = hojeIso;
        this.logger.log(`Digest diário: enviado=${r.ok}`);
      }
    } catch (e) {
      this.logger.error('Robô de digest falhou', e instanceof Error ? e.stack : String(e));
    }
  }
}
