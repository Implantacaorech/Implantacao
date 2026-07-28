import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_MENU_DICIONARIO } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { DicionarioService } from './dicionario.service';
import { DicionarioIaService } from './dicionario-ia.service';
import { PesquisarDicionarioDto } from './dto/pesquisar-dicionario.dto';
import { PerguntarDicionarioDto } from './dto/perguntar-dicionario.dto';

/** Dicionário Inteligente do SIGER® — consulta técnica sobre os documentos curados
 * (módulos + adicionais, repositório Documentacao-Fonte-P). Restrito ao Administrador
 * (definição do usuário em 2026-07-28). A rota `/perguntar` sintetiza uma resposta por IA
 * a partir dos documentos, sempre citando as fontes. */
@ApiTags('dicionario')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_MENU_DICIONARIO)
@Controller('dicionario')
export class DicionarioController {
  constructor(
    private readonly service: DicionarioService,
    private readonly ia: DicionarioIaService,
  ) {}

  @Get('pesquisar')
  @ApiOperation({ summary: 'Pesquisa documentos por termo/tipo/sigla' })
  async pesquisar(@Query() dto: PesquisarDicionarioDto) {
    return new ApiEnvelope(await this.service.pesquisar(dto));
  }

  @Get('siglas')
  @ApiOperation({ summary: 'Lista módulos/adicionais para os filtros' })
  async siglas() {
    return new ApiEnvelope(await this.service.siglas());
  }

  @Get('status')
  @ApiOperation({
    summary: 'Cobertura da base (quantos documentos, última ingestão)',
  })
  async status() {
    return new ApiEnvelope(await this.service.status());
  }

  @Post('perguntar')
  @ApiOperation({
    summary: 'Resposta em linguagem natural fundamentada nos documentos (RAG)',
  })
  async perguntar(@Body() dto: PerguntarDicionarioDto) {
    return new ApiEnvelope(await this.ia.perguntar(dto.pergunta));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Documento completo (conteúdo + seções + fonte)' })
  async obter(@Param('slug') slug: string) {
    return new ApiEnvelope(await this.service.obter(slug));
  }
}
