import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { TecnicosSiclaService } from './tecnicos-sicla.service';
import { ImportarTecnicosDto } from './dto/importar-tecnicos.dto';

/** Fonte dos Usuários: `SICLA.LISTA_TECNICOS`. Exclusivo do Administrador — acompanha a
 * tela de Usuários, que fica sob Sistema (fixo-ADM, fora do RBAC configurável). */
@ApiTags('tecnicos-sicla')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('tecnicos-sicla')
export class TecnicosSiclaController {
  constructor(private readonly service: TecnicosSiclaService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os técnicos do SICLA (LISTA_TECNICOS). `termo` filtra; `novos=1` traz só quem ainda não tem cadastro no Painel',
  })
  async listar(@Query('termo') termo?: string, @Query('novos') novos?: string) {
    const somenteNovos = novos === '1' || novos === 'true';
    return new ApiEnvelope(
      await this.service.listar(termo ?? '', somenteNovos),
    );
  }

  @Post('importar')
  @ApiOperation({
    summary:
      'Importa técnicos do SICLA para Usuários (novos entram com a senha padrão)',
  })
  async importar(@Body() dto: ImportarTecnicosDto) {
    return new ApiEnvelope(await this.service.importar(dto.codigos));
  }
}
