import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { AgentesService } from './agentes.service';
import { IniciarExecucaoDto } from './dto/iniciar-execucao.dto';
import { ConcluirExecucaoDto } from './dto/concluir-execucao.dto';
import { ListarExecucoesDto } from './dto/listar-execucoes.dto';

/** Telemetria real de execuções de agentes/subagentes (`.claude/agents/`) — painel "Agentes
 * de IA" dentro do Centro de Monitoramento Operacional. Só existe dado aqui quando um agente
 * de fato chamou `POST`/`PATCH` — nunca simulado. Ver vault/14 - IA/. */
@ApiTags('agentes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Controller('agentes')
export class AgentesController {
  constructor(private readonly service: AgentesService) {}

  @Post('execucoes')
  // M4 (auditoria 2026-08-12): antes `@Roles()` vazio deixava QUALQUER autenticado injetar
  // telemetria falsa, contrariando a garantia "não é simulação". Passa a exigir alteração no
  // Centro Operacional — o agente reporta com token ADM, que tem essa permissão.
  @Permissao('centro_operacional', 'alteracao')
  @ApiOperation({
    summary: 'Registra o início real de uma execução de agente/subagente',
  })
  async iniciar(@Body() dto: IniciarExecucaoDto) {
    return new ApiEnvelope(await this.service.iniciar(dto));
  }

  @Patch('execucoes/:id')
  @Permissao('centro_operacional', 'alteracao')
  @ApiOperation({
    summary: 'Conclui (ou marca falha) uma execução em andamento',
  })
  async concluir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConcluirExecucaoDto,
  ) {
    return new ApiEnvelope(await this.service.concluir(id, dto));
  }

  @Get('execucoes')
  @Permissao('centro_operacional')
  @ApiOperation({
    summary: 'Lista execuções recentes (dashboard de Monitoramento)',
  })
  async listar(@Query() filtro: ListarExecucoesDto) {
    const ativos = filtro.ativos === 'true';
    const limite = parseInt(filtro.limite ?? '50', 10) || 50;
    return new ApiEnvelope(await this.service.listar(ativos, limite));
  }

  @Get('grafo')
  @Permissao('centro_operacional')
  @ApiOperation({
    summary:
      'Topologia dos 13 agentes (.claude/agents/) + status real das últimas 24h',
  })
  async grafo() {
    return new ApiEnvelope(await this.service.grafo());
  }
}
