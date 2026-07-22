import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_GESTAO } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { DashboardsService } from './dashboards.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

/** Aba Dashboards — visível a ADM/Coordenador/Administrativo/GCI (não Consultor). Espelha
 * webapp/routes_dashboards.py, generalizado (ver DashboardsService). */
@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GESTAO)
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os dashboards disponíveis (consultas com colunaData preenchida)',
  })
  async listar() {
    return new ApiEnvelope({
      itens: await this.dashboards.listarDisponiveis(),
    });
  }

  @Get(':slug')
  @ApiOperation({
    summary:
      'Roda o dashboard: período, filtros, tabela e gráfico (se aplicável)',
  })
  async rodar(@Param('slug') slug: string, @Query() query: QueryDashboardDto) {
    return new ApiEnvelope(await this.dashboards.rodar(slug, query));
  }
}
