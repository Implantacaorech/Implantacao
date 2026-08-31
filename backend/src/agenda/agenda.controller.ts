import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { AgendaService } from './agenda.service';
import { QueryAgendaCalendarioDto } from './dto/query-agenda-calendario.dto';

/** Tela **Execução → Agenda** — calendário de compromissos dos técnicos (origem SICLA).
 * Gate pelo menu `agenda`: só leitura, então o nível `consulta` (default do decorator)
 * basta para tudo que existe aqui. */
@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('agenda')
@Controller('agenda')
export class AgendaController {
  constructor(private readonly servico: AgendaService) {}

  @Get('calendario')
  @ApiOperation({
    summary: 'Compromissos dos técnicos numa janela livre de dias',
  })
  async calendario(@Query() query: QueryAgendaCalendarioDto) {
    return new ApiEnvelope(await this.servico.calendario(query));
  }

  @Get('usuarios')
  @ApiOperation({
    summary:
      'Usuários do Painel (id e nome, ativos ou não) para o filtro de técnicos',
  })
  async usuarios() {
    return new ApiEnvelope(await this.servico.usuarios());
  }
}
