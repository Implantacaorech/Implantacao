import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { AutomacaoService } from './automacao.service';
import { PausarAutomacaoDto } from './dto/pausar-automacao.dto';

/** Kill switch de runtime da automação e da IA (eixo 4). Fica sob a permissão do Centro de
 * Monitoramento Operacional — o mesmo lugar de onde se acompanha saúde, agentes e custo de IA.
 * Pausar é ação de alteração; ler o estado é consulta. */
@ApiTags('automacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('automacao')
export class AutomacaoController {
  constructor(private readonly service: AutomacaoService) {}

  @Get()
  @Permissao('centro_operacional')
  @ApiOperation({
    summary: 'Estado do kill switch (automação/IA ativa ou pausada)',
  })
  estado() {
    return new ApiEnvelope(this.service.estado());
  }

  @Post('pausar')
  @HttpCode(HttpStatus.OK)
  @Permissao('centro_operacional', 'alteracao')
  @ApiOperation({
    summary:
      'PAUSA a automação e a IA — os robôs param de trabalhar e a IA recusa chamadas',
  })
  pausar(@Body() dto: PausarAutomacaoDto, @CurrentUser() user: AuthUser) {
    return new ApiEnvelope(this.service.pausar(dto.motivo ?? '', user.nome));
  }

  @Post('retomar')
  @HttpCode(HttpStatus.OK)
  @Permissao('centro_operacional', 'alteracao')
  @ApiOperation({ summary: 'Retoma a automação e a IA' })
  retomar(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(this.service.retomar(user.nome));
  }
}
