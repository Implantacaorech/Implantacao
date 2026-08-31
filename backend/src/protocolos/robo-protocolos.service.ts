import {
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppConfig } from '../config/configuration';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { AgentesService } from '../agentes/agentes.service';
import { killSwitch } from '../common/automacao/kill-switch';
import {
  heartbeatRobos,
  ROBO_PROTOCOLOS,
} from '../common/observabilidade/heartbeat-robos';

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
    // @Optional: em teste o robô é montado sem a telemetria de agentes; ali o registro
    // simplesmente não acontece. Em produção o Nest injeta o AgentesService.
    @Optional() private readonly agentes?: AgentesService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    // F1 da migração p/ servidor dedicado: `configurado()` devolvendo false desligava o
    // robô EM SILÊNCIO (pasta inexistente = nenhum vídeo processado, nenhum erro, nenhum
    // aviso). Denuncia no boot, uma vez, com o caminho resolvido.
    if (!this.processamento.configurado()) {
      this.logger.error(
        `Pasta de vídeos não encontrada: "${this.config.get('protocolosDir', { infer: true })}" — ` +
          'o robô de protocolos fica DESATIVADO até ela existir ' +
          '(defina MIGRACAO_PROTOCOLOS_DIR; ver docs/migracao-servidor.md).',
      );
    }
    const mins = this.config.get('protocolosPollMin', { infer: true });
    const ms = Math.max(120, mins * 60) * 1000;
    const intervalo = setInterval(() => {
      void this.tick();
    }, ms);
    heartbeatRobos.registrar(
      ROBO_PROTOCOLOS,
      'Robô de protocolos (SharePoint/Vídeos Pendentes)',
      true,
      ms,
    );
    this.scheduler.addInterval(NOME_INTERVALO, intervalo);
  }

  onModuleDestroy(): void {
    if (this.scheduler.doesExist('interval', NOME_INTERVALO)) {
      this.scheduler.deleteInterval(NOME_INTERVALO);
    }
  }

  async tick(): Promise<void> {
    heartbeatRobos.bater(ROBO_PROTOCOLOS); // M6: o laço está vivo
    // Eixo 4: com a automação pausada pelo ADM, o robô não processa nada (o laço segue vivo,
    // só não age). A IA também recusaria, mas parar aqui evita começar a transcrever à toa.
    if (killSwitch.pausado()) return;
    try {
      if (this.processamento.configurado()) {
        const n = await this.processamento.processarPendentes();
        if (n) {
          this.logger.log(`Robô de protocolos: ${n} vídeo(s) processado(s).`);
          // Eixo 4: execução AUTÔNOMA REAL na telemetria de agentes — atribuída ao agente de
          // software dono da geração/transcrição de documentos. Best-effort (não derruba o tick).
          void this.agentes?.registrarCiclo(
            'documentos-geracao',
            `Robô de protocolos: ${n} vídeo(s) processado(s) automaticamente.`,
            true,
          );
        }
      }
    } catch (e) {
      heartbeatRobos.bater(
        ROBO_PROTOCOLOS,
        'erro',
        e instanceof Error ? e.message : String(e),
      );
      void this.agentes?.registrarCiclo(
        'documentos-geracao',
        'Robô de protocolos falhou ao processar os vídeos pendentes.',
        false,
      );
      this.logger.error(
        'Robô de protocolos falhou',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
