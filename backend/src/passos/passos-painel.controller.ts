import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PassosService } from './passos.service';
import { PASSOS } from './passos.constants';

/** Dados do PROCESSO para a carteira (quadro por fase), não de um projeto específico.
 *
 * Separado de `PassosController` porque aquele é `projetos/:id` — aqui a pergunta é sobre
 * todos os projetos de uma vez. */
@ApiTags('passos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('passos')
export class PassosPainelController {
  constructor(private readonly passos: PassosService) {}

  @Get('definicoes')
  @Roles()
  @ApiOperation({
    summary:
      'Os 18 passos do processo (número, título, macro-etapa, responsável)',
  })
  definicoes() {
    return new ApiEnvelope(PASSOS);
  }

  @Get('atuais')
  @Roles()
  @ApiOperation({
    summary: 'Em que passo cada projeto está — alimenta o quadro por fase',
  })
  async atuais() {
    return new ApiEnvelope(await this.passos.passoAtualDeTodos());
  }
}
