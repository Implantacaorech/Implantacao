import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { IaTelemetriaService } from './ia-telemetria.service';

/** Telemetria de custo/execuções de IA (`GET /api/ia/telemetria`) — alimenta a seção "Custo de
 * IA" do Centro de Monitoramento. Mesma permissão do Centro Operacional (`centro_operacional`),
 * sem chave de RBAC nova. */
@ApiTags('ia-telemetria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('ia/telemetria')
export class IaTelemetriaController {
  constructor(private readonly service: IaTelemetriaService) {}

  @Get()
  @Permissao('centro_operacional', 'consulta')
  @ApiOperation({
    summary:
      'Custo estimado (hoje/7 dias), tokens e execuções de IA por finalidade, últimas chamadas e status do teto diário',
  })
  async resumo() {
    return new ApiEnvelope(await this.service.resumo());
  }
}
