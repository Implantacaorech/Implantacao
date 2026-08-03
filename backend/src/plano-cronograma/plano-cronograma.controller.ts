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
import { PERFIS_GERA_CRONOGRAMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { PlanoCronogramaService } from './plano-cronograma.service';
import { SalvarCronogramaDto } from './dto/salvar-cronograma.dto';
import { SalvarChecklistDto } from './dto/salvar-checklist.dto';

/** Linhas editáveis do Cronograma/Check List (`/projetos/:id/cronograma`,
 * `/projetos/:id/checklist`) — NÃO confundir com o Agendador de Visitas
 * (`/projetos/:id/agenda*`, item 1). Espelha webapp/routes_cronograma.py.
 *
 * **Gate aplicado a TODAS as rotas, diferente do Flask original**: lá, só
 * `/cronograma/gerar` (geração do documento — ainda não portada, ver
 * docs/migracao/03-documento-conversao.md) tinha `pode_gerar("cronograma")`; as rotas de
 * edição/seed não tinham NENHUM controle de acesso além do login. Decisão deliberada
 * desta conversão: aplicar `PERFIS_GERA_CRONOGRAMA` (mesmo grupo do Flask) também às
 * edições — deixar um endpoint de escrita sem gate de perfil não é um comportamento a
 * preservar por fidelidade, é uma falha de controle de acesso a corrigir.
 *
 * Camada de ENTRADA apenas (Guia Mestre §Responsabilidades): rota, guard, validação do DTO
 * e envelope de resposta. Nada de regra nem de persistência — isso é do
 * `PlanoCronogramaService`. */
@ApiTags('plano-cronograma')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GERA_CRONOGRAMA)
@Controller('projetos/:id')
export class PlanoCronogramaController {
  constructor(private readonly plano: PlanoCronogramaService) {}

  // --- Cronograma ---

  @Get('cronograma')
  @ApiOperation({ summary: 'Linhas do Cronograma + histórico de edições' })
  async obterCronograma(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.plano.obterCronograma(id));
  }

  @Post('cronograma')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Substitui as linhas do Cronograma (apaga tudo e reinsere, com histórico)',
  })
  async salvarCronograma(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarCronogramaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.plano.salvarCronograma(id, dto.linhas, user.nome),
    );
  }

  @Post('cronograma/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Substitui as linhas do Cronograma pelo plano automático (destrutivo)',
  })
  async seedCronograma(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.plano.seedCronograma(id, user.nome));
  }

  // --- Check List ---

  @Get('checklist')
  @ApiOperation({ summary: 'Linhas do Check List + histórico de edições' })
  async obterChecklist(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.plano.obterChecklist(id));
  }

  @Post('checklist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Substitui as linhas do Check List (apaga tudo e reinsere, com histórico)',
  })
  async salvarChecklist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarChecklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(
      await this.plano.salvarChecklist(id, dto.linhas, user.nome),
    );
  }

  @Post('checklist/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Substitui as linhas do Check List pelo roteiro dos módulos (destrutivo)',
  })
  async seedChecklist(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.plano.seedChecklist(id, user.nome));
  }
}
