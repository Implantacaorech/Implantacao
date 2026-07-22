import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  PERFIS_AGENDAMENTO,
  PERFIS_DEFINE_GCI,
  PERFIS_DESIGNA_CONSULTORES,
} from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { DesignacaoService } from './designacao.service';
import { DefinirGciDto } from './dto/definir-gci.dto';
import { AgendarLevantamentoDto } from './dto/agendar-levantamento.dto';
import { DesignarConsultoresDto } from './dto/designar-consultores.dto';

/** Fluxo de Designação por projeto (`/projetos/:id/definir-gci`, `/agendar`,
 * `/consultores`). Cada rota tem um gate PRÓPRIO e deliberadamente distinto — não é
 * inconsistência, é o processo real (ver as constantes em common/constants/perfis.ts).
 *
 * Revisão de 2026-07-22: agendar o Levantamento segue com o Administrativo (passo 2), mas
 * definir o GCI e designar os consultores passaram para o COORDENADOR (passo 6). */
@ApiTags('designacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projetos/:id')
export class DesignacaoController {
  constructor(private readonly service: DesignacaoService) {}

  @Get('definir-gci')
  @Roles(...PERFIS_DEFINE_GCI)
  @ApiOperation({
    summary: 'Passo 6 (Coordenador): dados para definir o GCI',
  })
  async obterDefinirGci(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.service.obterDefinirGci(id));
  }

  @Post('definir-gci')
  @Roles(...PERFIS_DEFINE_GCI)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Passo 6 (Coordenador): define o GCI — sem notificar ainda',
  })
  async definirGci(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DefinirGciDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.service.definirGci(id, dto.gcis, user.nome),
    );
  }

  @Get('agendar')
  @Roles(...PERFIS_AGENDAMENTO)
  @ApiOperation({
    summary: 'Passo 2 (Administrativo): dados para agendar o Levantamento',
  })
  async obterAgendar(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.service.obterAgendar(id));
  }

  @Post('agendar')
  @Roles(...PERFIS_AGENDAMENTO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Etapa 2 (Administrativo): confirma a data do Levantamento, notifica o(s) GCI(s) e auto-avança a etapa',
  })
  async agendar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgendarLevantamentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.service.agendar(id, dto.dataLevantamento, user.nome),
    );
  }

  @Get('consultores')
  @Roles(...PERFIS_DESIGNA_CONSULTORES)
  @ApiOperation({
    summary: 'Etapa 6 (GCI): dados para designar os consultores por módulo',
  })
  async obterConsultores(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.service.obterConsultores(id));
  }

  @Post('consultores')
  @Roles(...PERFIS_DESIGNA_CONSULTORES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Etapa 6 (GCI): designa os consultores, notifica cada um e auto-avança a etapa',
  })
  async designarConsultores(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DesignarConsultoresDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.service.designarConsultores(id, dto.designacoes, user.nome),
    );
  }
}
