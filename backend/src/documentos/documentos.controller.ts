import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { DocumentosService } from './documentos.service';
import { GeracaoLayoutService, SlugDocumentoFiel } from './geracao-layout.service';

const _SLUGS_DOCX: readonly SlugDocumentoFiel[] = ['levantamento', 'projeto', 'termo'];

@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentosController {
  constructor(
    private readonly documentos: DocumentosService,
    private readonly geracaoLayout: GeracaoLayoutService,
  ) {}

  @Get('projetos/:projetoId/documentos')
  @ApiOperation({ summary: 'Lista os documentos gerados/anexados ao projeto' })
  listarDocumentos(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.documentos.listarDocumentos(projetoId);
  }

  @Get('projetos/:projetoId/eventos')
  @ApiOperation({ summary: 'Timeline (histórico de eventos) do projeto' })
  listarEventos(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.documentos.listarEventos(projetoId);
  }

  @Get('documentos/:id/baixar')
  @ApiOperation({ summary: 'Baixa um documento gerado/anexado' })
  async baixar(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.documentos.buscarDocumento(id);
    if (!doc || !existsSync(doc.caminho)) throw new NotFoundException('Documento não encontrado.');
    res.download(doc.caminho, doc.arquivo);
  }

  @Post('projetos/:projetoId/gerar-layout/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gera o Levantamento, Projeto ou Termo (.docx) pelo layout fiel vigente e anexa ao projeto',
  })
  async gerarLayout(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('slug') slug: string,
    @Query('modo') modo: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!_SLUGS_DOCX.includes(slug as SlugDocumentoFiel)) {
      throw new BadRequestException(
        'slug inválido — use levantamento, projeto ou termo.',
      );
    }
    const arquivo = await this.geracaoLayout.gerar(
      projetoId,
      slug as SlugDocumentoFiel,
      modo === 'modelo' ? 'modelo' : 'auto',
    );

    // Anexa à ficha do projeto (Documento) + registra na timeline (Evento) — mesmo
    // comportamento de webapp/routes_geracao.py:_gerar_e_anexar_fiel.
    const salvo = this.documentos.salvarArquivoGerado(
      projetoId,
      arquivo.filename,
      arquivo.buffer,
    );
    await this.documentos.registrarDocumento(
      projetoId,
      slug,
      salvo.arquivo,
      salvo.caminho,
      'gerado',
    );
    const rotulo =
      `Gerou ${arquivo.filename} pelo layout oficial (${slug})` +
      (modo === 'modelo' ? ' — modelo p/ preenchimento manual' : '');
    await this.documentos.registrarEvento(projetoId, 'documento', rotulo, user.nome);

    res.set({
      'Content-Type': arquivo.contentType,
      'Content-Disposition': `attachment; filename="${arquivo.filename}"`,
    });
    res.send(arquivo.buffer);
  }
}
