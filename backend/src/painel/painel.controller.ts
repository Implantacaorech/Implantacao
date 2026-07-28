import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { CapacidadeService } from './capacidade.service';
import { CoordenacaoService } from './coordenacao.service';
import { AtividadeService } from './atividade.service';
import { HomeService } from './home.service';
import { MonitoramentoService } from './monitoramento.service';
import { DigestService } from '../digest/digest.service';
import { QueryCapacidadeDto } from './dto/query-capacidade.dto';

/** Telas-painel (visão executiva). Gate de Gestão = ADM/Coordenador/GCI (definição do
 * usuário em 2026-07-28 — o Administrativo saiu de Coordenação/Atividade/Monitoramento).
 * `home` sobrepõe para todos os autenticados. */
@ApiTags('painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Controller('painel')
export class PainelController {
  constructor(
    private readonly capacidade: CapacidadeService,
    private readonly coordenacao: CoordenacaoService,
    private readonly atividade: AtividadeService,
    private readonly home: HomeService,
    private readonly digest: DigestService,
    private readonly monitoramento: MonitoramentoService,
  ) {}

  @Get('home')
  @Roles() // sobrepõe o @Roles(...PERFIS_GESTAO) da classe — todos os perfis autenticados
  @ApiOperation({
    summary: 'Home: KPIs + fila de próximas ações + projeto em foco',
  })
  async painelHome(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.home.painel(user));
  }

  @Get('coordenacao')
  @Permissao('coordenacao')
  @ApiOperation({
    summary: 'Painel de Coordenação: KPIs, funil, atrasados, alertas',
  })
  async painelCoordenacao(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.coordenacao.painel(user));
  }

  @Get('coordenacao/capacidade')
  @Permissao('coordenacao')
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
  @Permissao('atividade')
  @ApiOperation({
    summary: 'Atividade da operação: uso 30 dias, funil macro, feed de eventos',
  })
  async painelAtividade(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.atividade.painel(user));
  }

  @Post('coordenacao/digest')
  @Permissao('coordenacao', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Dispara manualmente o resumo diário por e-mail (botão "enviar agora")',
  })
  async enviarDigest() {
    return new ApiEnvelope(await this.digest.enviar());
  }

  @Get('monitoramento')
  @Permissao('centro_operacional')
  @ApiOperation({
    summary:
      'Centro de Monitoramento Operacional: setores, saúde, carga, entregas e mapa de progresso',
  })
  async painelMonitoramento(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.monitoramento.painel(user));
  }
}
