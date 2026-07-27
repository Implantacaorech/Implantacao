import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ModulosSiclaService } from './modulos-sicla.service';

/** Passo 1: consulta de módulos/adicionais no SICLA para marcar os contratados. */
@ApiTags('modulos-sicla')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('modulos-sicla')
export class ModulosSiclaController {
  constructor(private readonly service: ModulosSiclaService) {}

  @Get('buscar')
  @Roles('ADM', 'Comercial', 'Administrativo', 'Coordenador')
  @ApiOperation({
    summary: 'Busca módulos/adicionais no SICLA por código ou descrição',
  })
  async buscar(@Query('termo') termo: string) {
    return new ApiEnvelope(await this.service.buscar(termo ?? ''));
  }
}
