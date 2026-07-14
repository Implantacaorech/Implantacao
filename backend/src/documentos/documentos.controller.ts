import { Controller, Get, NotFoundException, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentosService } from './documentos.service';

@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

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
}
