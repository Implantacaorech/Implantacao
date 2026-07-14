import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_GESTAO } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { CapacidadeService } from './capacidade.service';
import { CoordenacaoService } from './coordenacao.service';
import { AtividadeService } from './atividade.service';
import { HomeService } from './home.service';
import { QueryCapacidadeDto } from './dto/query-capacidade.dto';

/** Telas-painel (visão executiva). Espelha webapp/routes_painel.py — gate único
 * `pode_ver("gestao")` (ADM/Coordenador/Administrativo/GCI; Consultor não acessa). */
@ApiTags('painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GESTAO)
@Controller('painel')
export class PainelController {
  constructor(
    private readonly capacidade: CapacidadeService,
    private readonly coordenacao: CoordenacaoService,
    private readonly atividade: AtividadeService,
    private readonly home: HomeService,
  ) {}

  @Get('home')
  @Roles() // sobrepõe o @Roles(...PERFIS_GESTAO) da classe — todos os perfis autenticados
  @ApiOperation({ summary: 'Home: KPIs + fila de próximas ações + projeto em foco' })
  async painelHome(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.home.painel(user));
  }

  @Get('coordenacao')
  @ApiOperation({ summary: 'Painel de Coordenação: KPIs, funil, atrasados, alertas' })
  async painelCoordenacao(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.coordenacao.painel(user));
  }

  @Get('coordenacao/capacidade')
  @ApiOperation({
    summary:
      'Capacidade da equipe p/ receber cliente novo: módulos x matriz x agenda x go-live',
  })
  async avaliarCapacidade(@Query() filtro: QueryCapacidadeDto) {
    const modulos = (filtro.modulos || '')
      .replace(/;/g, ',')
      .split(',')
      .filter((m) => m.trim());
    let semanas = 6;
    const bruto = parseInt(filtro.semanas ?? '', 10);
    if (!Number.isNaN(bruto)) semanas = Math.max(2, Math.min(12, bruto));
    const r = await this.capacidade.avaliarEquipe(modulos, semanas);
    return new ApiEnvelope(r);
  }

  @Get('atividade')
  @ApiOperation({ summary: 'Atividade da operação: uso 30 dias, funil macro, feed de eventos' })
  async painelAtividade(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.atividade.painel(user));
  }
}
