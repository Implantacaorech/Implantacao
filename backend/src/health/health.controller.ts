import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';

// Fora do rate limit global de propósito: o Guardião (Guardiao_Painel_Novo.vbs) e a Tarefa
// Agendada de verificação batem aqui em intervalo curto e sempre do MESMO IP (a própria
// máquina). Barrar o healthcheck por 429 faria o guardião concluir que o painel caiu e
// reiniciar um processo saudável — o inverso do que a proteção existe para fazer.
@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary:
      'Healthcheck — usado pelo Guardião/monitoramento (equivalente a GET /health do Flask)',
  })
  async check() {
    return this.health.verificar();
  }
}
