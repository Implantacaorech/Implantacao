import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ChecklistModeloService } from './checklist-modelo.service';
import { IndiceTopicoService } from './indice-topico.service';
import { ModeloDocumentoService } from './modelo-documento.service';
import { SalvarChecklistModeloDto } from './dto/checklist-modelo.dto';
import { SalvarIndiceTopicoDto } from './dto/indice-topico.dto';
import { SalvarModeloDocumentoCampoDto } from './dto/modelo-documento-campo.dto';

/** Telas de Cadastros (/cadastros/*) — exclusivo do Administrador (`pode_ver("sistema")`
 * no Flask). Espelha webapp/routes_cadastros.py. */
@ApiTags('cadastros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('cadastros')
export class CatalogosController {
  constructor(
    private readonly checklist: ChecklistModeloService,
    private readonly indice: IndiceTopicoService,
    private readonly modelos: ModeloDocumentoService,
  ) {}

  // --- Check List --------------------------------------------------------------------

  @Get('checklist')
  @ApiOperation({
    summary: 'Catálogo de referência do roteiro/check-list por módulo',
  })
  async checklistListar(
    @Query('mod') mod?: string,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limite') limite?: string,
  ) {
    const { linhas, total } = await this.checklist.listar({
      modulo: mod,
      q,
      offset: offset ? Number(offset) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
    const modulos = await this.checklist.modulosDistintos();
    return new ApiEnvelope({ linhas, total, modulos });
  }

  @Post('checklist')
  @ApiOperation({ summary: 'Cria/atualiza uma linha do catálogo de checklist' })
  checklistSalvar(@Body() dto: SalvarChecklistModeloDto) {
    return this.checklist.salvar(dto);
  }

  @Delete('checklist/:id')
  @ApiOperation({ summary: 'Exclui uma linha do catálogo de checklist' })
  async checklistExcluir(@Param('id', ParseIntPipe) id: number) {
    await this.checklist.excluir(id);
    return new ApiEnvelope(null, 'Linha removida.');
  }

  @Post('checklist/reimportar')
  @ApiOperation({ summary: 'Reimporta o catálogo do YAML, substituindo tudo' })
  async checklistReimportar() {
    const n = await this.checklist.reimportar();
    return new ApiEnvelope(
      { n },
      `Catálogo reimportado do modelo (${n} linhas).`,
    );
  }

  // --- Índice de Tópicos ---------------------------------------------------------------

  @Get('indice')
  @ApiOperation({
    summary: 'Catálogo do Índice de Tópicos para Mapeamento de Processos',
  })
  async indiceListar(@Query('mod') mod?: string, @Query('q') q?: string) {
    const { linhas, total } = await this.indice.listar({ modulo: mod, q });
    const modulos = await this.indice.modulos();
    return new ApiEnvelope({ linhas, total, modulos });
  }

  @Post('indice')
  @ApiOperation({ summary: 'Cria/atualiza um tópico do índice' })
  indiceSalvar(@Body() dto: SalvarIndiceTopicoDto) {
    return this.indice.salvar(dto);
  }

  @Delete('indice/:id')
  @ApiOperation({ summary: 'Exclui um tópico do índice' })
  async indiceExcluir(@Param('id', ParseIntPipe) id: number) {
    await this.indice.excluir(id);
    return new ApiEnvelope(null, 'Tópico removido.');
  }

  @Post('indice/reimportar')
  @ApiOperation({ summary: 'Reimporta o índice do YAML, substituindo tudo' })
  async indiceReimportar() {
    const n = await this.indice.reimportar();
    return new ApiEnvelope(
      { n },
      `Índice reimportado da planilha (${n} tópicos).`,
    );
  }

  // --- Modelos de Documentos -------------------------------------------------------------

  @Get('modelos')
  @ApiOperation({
    summary: 'Lista os modelos de documento (layouts fiéis das fases)',
  })
  modelosListar() {
    return this.modelos.listar();
  }

  @Get('modelos/:id')
  @ApiOperation({
    summary: 'Detalhe de um modelo: versões + campos (mapa de preenchimento)',
  })
  async modeloDetalhe(@Param('id', ParseIntPipe) id: number) {
    const [modelo, versoes, campos] = await Promise.all([
      this.modelos.obter(id),
      this.modelos.versoes(id),
      this.modelos.campos(id),
    ]);
    return new ApiEnvelope({ modelo, versoes, campos });
  }

  @Post('modelos/:id/versao')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Envia uma nova versão do arquivo do modelo (.docx/.xlsx, igual ao tipo cadastrado)',
  })
  async modeloEnviarVersao(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('motivo') motivo: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo)
      throw new UnprocessableEntityException(
        'Selecione um arquivo para enviar.',
      );
    const r = await this.modelos.enviarVersao(
      id,
      arquivo.originalname,
      arquivo.buffer,
      user.nome,
      motivo || '',
    );
    if (!r.ok) throw new UnprocessableEntityException(r.erro);
    return new ApiEnvelope({ versao: r.versao }, 'Nova versão enviada.');
  }

  @Get('modelos/:id/baixar')
  @ApiOperation({
    summary:
      'Baixa o arquivo vigente (ou uma versão específica, via ?versaoId=)',
  })
  async modeloBaixar(
    @Param('id', ParseIntPipe) id: number,
    @Query('versaoId') versaoId: string | undefined,
    @Res() res: Response,
  ) {
    const modelo = await this.modelos.obter(id);
    const caminho = await this.modelos.arquivoPath(
      id,
      versaoId ? Number(versaoId) : undefined,
    );
    if (!caminho) throw new NotFoundException('Arquivo não encontrado.');
    const nome = `${modelo.slug}_${versaoId ? `v${versaoId}` : 'vigente'}.${modelo.tipo}`;
    res.download(caminho, nome);
  }

  @Post('modelos/:id/campos')
  @ApiOperation({ summary: 'Cria/atualiza um campo do mapa de preenchimento' })
  modeloCampoSalvar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarModeloDocumentoCampoDto,
  ) {
    return this.modelos.salvarCampo(id, dto);
  }

  @Delete('modelos/:id/campos/:campoId')
  @ApiOperation({ summary: 'Exclui um campo do mapa de preenchimento' })
  async modeloCampoExcluir(@Param('campoId', ParseIntPipe) campoId: number) {
    await this.modelos.excluirCampo(campoId);
    return new ApiEnvelope(null, 'Campo removido.');
  }
}
