import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BiMovimentosService } from './bi-movimentos.service';
import { QueryMovimentosDto } from './dto/query-movimentos.dto';

/** "Movimentos de trabalho efetivo" — página do `BI_Interno.pbix` na aba **BI Implantação**.
 * Gate pelo menu `dashboards`, igual às demais páginas dessa aba. */
@ApiTags('bi-movimentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('dashboards')
@Controller('bi-movimentos')
export class BiMovimentosController {
  constructor(private readonly servico: BiMovimentosService) {}

  @Get()
  @ApiOperation({
    summary: 'Horas de trabalho efetivo por técnico e tipo de movimento',
  })
  async movimentos(@Query() query: QueryMovimentosDto) {
    return new ApiEnvelope(await this.servico.movimentos(query));
  }
}
