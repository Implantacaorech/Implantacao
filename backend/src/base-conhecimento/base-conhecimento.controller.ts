import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BaseConhecimentoService } from './base-conhecimento.service';
import { PesquisarSigerDto } from './dto/pesquisar-siger.dto';

/** Busca textual sobre o código-fonte do SIGER® (origem: F:\Fontes, indexado pela ferramenta
 * externa BaseConhecimentoSiger). Qualquer perfil autenticado pode pesquisar — é uma
 * ferramenta de consulta, não de gestão. Ver `status` para a cobertura real hoje (parcial,
 * por restrição de ACL no servidor de arquivos). */
@ApiTags('base-conhecimento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('base-conhecimento')
export class BaseConhecimentoController {
  constructor(private readonly service: BaseConhecimentoService) {}

  @Get('pesquisar')
  @ApiOperation({ summary: 'Pesquisa por caminho/conteúdo indexado do código-fonte do SIGER®' })
  async pesquisar(@Query() dto: PesquisarSigerDto) {
    if (!dto.q) return new ApiEnvelope([]);
    return new ApiEnvelope(await this.service.pesquisar(dto.q));
  }

  @Get('status')
  @ApiOperation({ summary: 'Cobertura da indexação (quantos arquivos, quando foi a última importação)' })
  async status() {
    return new ApiEnvelope(await this.service.status());
  }
}
