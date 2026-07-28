import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ModulosSiclaService } from './modulos-sicla.service';

/** Passo 1: consulta de módulos/adicionais no SICLA para marcar os contratados. */
@ApiTags('modulos-sicla')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('modulos-sicla')
export class ModulosSiclaController {
  constructor(private readonly service: ModulosSiclaService) {}

  @Get('buscar')
  @Permissao('novo_cliente')
  @ApiOperation({
    summary: 'Busca módulos/adicionais no SICLA por código ou descrição',
  })
  async buscar(@Query('termo') termo: string) {
    return new ApiEnvelope(await this.service.buscar(termo ?? ''));
  }
}
