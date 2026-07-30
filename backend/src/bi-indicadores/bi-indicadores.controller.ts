import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BiIndicadoresService } from './bi-indicadores.service';
import { QueryIndicadoresDto } from './dto/query-indicadores.dto';

/** Indicadores de Implantação — páginas do `BI_Interno.pbix` que vivem na aba
 * **BI Implantação**. Gate pelo menu `dashboards` (o dessa aba), NÃO por `bi_implantacao`,
 * que é o do Implantação Clientes SIGER. */
@ApiTags('bi-indicadores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('dashboards')
@Controller('bi-indicadores')
export class BiIndicadoresController {
  constructor(private readonly indicadores: BiIndicadoresService) {}

  @Get()
  @ApiOperation({
    summary:
      'Indicadores de Contratação, Conclusão e % de Utilização das Horas (mesma view, um payload)',
  })
  async listar(@Query() query: QueryIndicadoresDto) {
    return new ApiEnvelope(await this.indicadores.indicadores(query));
  }
}
