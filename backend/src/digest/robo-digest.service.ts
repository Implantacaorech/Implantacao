import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/configuration';
import { DigestService } from './digest.service';
import { hojeIso } from '../cronograma/datas.util';

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
  private ultimoAviso: string | null = null; // "AAAA-MM-DD" do último aviso de "não enviei"

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
      // A hora comparada é local; a data do "já enviei hoje" precisa ser local também, senão
      // a chave vira o dia seguinte às 21h e a trava do dia se solta antes da meia-noite.
      const hoje = hojeIso();
      // Fora da hora, ou já enviado hoje: nada a fazer, em silêncio.
      if (agora.getHours() !== hora || this.ultimoEnvio === hoje) return;

      // A11 (auditoria 2026-08-12): a ausência de destinatário era SILENCIOSA — o tick não
      // fazia nada e não logava, então "não configurado", "não rodou" e "rodou e falhou" eram
      // indistinguíveis de fora. Resultado real: 0 envios de digest em todo o log de produção,
      // e o único canal de alerta do sistema nunca funcionou sem ninguém perceber. Agora, na
      // hora do envio, a falta de destinatário vira um aviso no log (uma vez por dia).
      if (this.digest.destinos().length === 0) {
        if (this.ultimoAviso !== hoje) {
          this.ultimoAviso = hoje;
          this.logger.warn(
            'Digest NÃO enviado hoje: sem destinatários. Defina a variável ' +
              'MIGRACAO_DIGEST_PARA para o resumo diário (e a saúde do sistema) sair por e-mail.',
          );
        }
        return;
      }

      const r = await this.digest.enviar();
      this.ultimoEnvio = hoje;
      this.logger.log(`Digest diário: enviado=${r.ok}`);
    } catch (e) {
      this.logger.error(
        'Robô de digest falhou',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
