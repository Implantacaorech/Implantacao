import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BiAgendaAlocacaoService } from './bi-agenda-alocacao.service';
import {
  QueryCalendarioAlocacaoDto,
  QueryHorasAplicadasDto,
} from './dto/query-agenda-alocacao.dto';

/** "Alocação de Agendas" — páginas do `BI_Interno.pbix` que vivem na aba **BI Implantação**.
 * Gate pelo menu `dashboards`, igual às três de Indicadores. */
@ApiTags('bi-agenda-alocacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('dashboards')
@Controller('bi-agenda-alocacao')
export class BiAgendaAlocacaoController {
  constructor(private readonly servico: BiAgendaAlocacaoService) {}

  @Get('calendario')
  @ApiOperation({ summary: 'Calendário de compromissos dos técnicos (mês)' })
  async calendario(@Query() query: QueryCalendarioAlocacaoDto) {
    return new ApiEnvelope(await this.servico.calendario(query));
  }

  @Get('horas-aplicadas')
  @ApiOperation({
    summary:
      'Horas previstas por RNS de implantação, por status do compromisso',
  })
  async horasAplicadas(@Query() query: QueryHorasAplicadasDto) {
    return new ApiEnvelope(await this.servico.horasAplicadas(query));
  }
}
