import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_GERA_LEVANTAMENTO } from '../common/constants/perfis';
import { LevantamentoRespostaService } from './levantamento-resposta.service';
import { DocConteudoService } from './doc-conteudo.service';
import type { DocumentoConteudo } from '../database/entities/doc-conteudo.entity';
import { ApiEnvelope } from '../common/dto/api-envelope';

@ApiTags('levantamento')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GERA_LEVANTAMENTO)
@Controller('projetos/:projetoId')
export class LevantamentoController {
  constructor(
    private readonly respostas: LevantamentoRespostaService,
    private readonly docConteudo: DocConteudoService,
  ) {}

  @Get('levantamento')
  @ApiOperation({
    summary:
      'Questionário do Levantamento (semeia do Índice de Tópicos na 1ª vez) + resumo',
  })
  async levantamento(@Param('projetoId', ParseIntPipe) projetoId: number) {
    await this.respostas.garantirSeed(projetoId);
    const [linhas, resumo] = await Promise.all([
      this.respostas.listar(projetoId),
      this.respostas.resumo(projetoId),
    ]);
    return new ApiEnvelope({ linhas, resumo });
  }

  @Put('levantamento')
  @ApiOperation({
    summary: 'Salva as respostas do Levantamento — { [id]: resposta }',
  })
  async salvarLevantamento(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() respostas: Record<string, string>,
  ) {
    const n = await this.respostas.salvar(projetoId, respostas);
    return new ApiEnvelope({ respondidas: n });
  }

  @Get('doc-conteudo/:doc')
  @ApiOperation({
    summary:
      'Campos estruturados de um documento (levantamento|projeto) por projeto',
  })
  docConteudoValores(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('doc') doc: DocumentoConteudo,
  ) {
    return this.docConteudo.valores(projetoId, doc);
  }

  @Put('doc-conteudo/:doc')
  @ApiOperation({
    summary: 'Salva campos estruturados de um documento (levantamento|projeto)',
  })
  async salvarDocConteudo(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('doc') doc: DocumentoConteudo,
    @Body() campos: Record<string, string>,
  ) {
    await this.docConteudo.salvar(projetoId, doc, campos);
    return new ApiEnvelope(null, 'Salvo.');
  }
}
