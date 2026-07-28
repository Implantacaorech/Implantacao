import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { DashboardsService } from './dashboards.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

/** Aba Dashboards — visível a TODOS os perfis autenticados (definição do usuário em
 * 2026-07-28: inclui Comercial). Ver DashboardsService. */
@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('dashboards')
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
