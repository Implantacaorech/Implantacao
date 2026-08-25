import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { INSTANCIAS, perfilDaInstancia } from '../common/instancia';

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

/** Quem é esta instância. **Público de propósito**: o front-end precisa saber qual menu
 * montar ANTES do login — a tela de login já é a do Portal API ou a do Painel. Não revela
 * nada: quem alcança a porta já sabe que há um servidor ali, e o nome do produto está no
 * título da página. */
@SkipThrottle()
@ApiTags('health')
@Controller('instancia')
export class InstanciaController {
  @Get()
  @ApiOperation({ summary: 'Perfil desta instância (painel | portal-api)' })
  qual() {
    const perfil = perfilDaInstancia();
    return { perfil, ...INSTANCIAS[perfil] };
  }
}
