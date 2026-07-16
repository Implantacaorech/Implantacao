import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { LegadoService } from './legado.service';
import {
  ClienteYamlDto,
  ConverterVerbalTextoDto,
  CriarTemplatesDto,
  FormModulosDto,
  GerarDto,
} from './dto/legado.dto';

/** Assistente administrativo legado (papéis/ações de teste dos geradores Office antigos
 * — tools/gerar_*.py) — só ADM (`pode_ver("sistema")` no Flask). Espelha
 * webapp/app.py:cliente/papel/acao + webapp/roles.py, forms.py, runner.py, mas via
 * ponte de subprocesso (LegadoCliService), nunca pelo docservice (ver
 * docs/migracao/02-decisao-arquitetura.md). O catálogo de papéis (roles.py, estático)
 * é hardcoded no Angular — não precisa de rota própria. */
@ApiTags('legado')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('legado')
export class LegadoController {
  constructor(private readonly legado: LegadoService) {}

  @Get('ia-status')
  @ApiOperation({ summary: 'Status da reconferência por IA (chave configurada?)' })
  async iaStatus() {
    return new ApiEnvelope(await this.legado.iaStatus());
  }

  @Get('saude')
  @ApiOperation({ summary: 'Roda o verificador (ambiente, templates, geradores) e devolve o relatório' })
  async saude() {
    return new ApiEnvelope(await this.legado.saude());
  }

  @Get('catalogo')
  @ApiOperation({ summary: 'Catálogo de módulos por área, para a seleção de módulos' })
  async catalogo() {
    return new ApiEnvelope(await this.legado.catalogo());
  }

  @Post('cliente')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grava o dossiê do cliente (YAML) usado como base pelos geradores' })
  async definirCliente(@Body() dto: ClienteYamlDto) {
    return new ApiEnvelope(await this.legado.definirCliente(dto.form ?? {}));
  }

  @Post('criar-templates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera o Mapeamento de Processos e/ou o Termo de Encerramento (tela tabbada)' })
  async criarTemplates(@Body() dto: CriarTemplatesDto) {
    return new ApiEnvelope(await this.legado.criarTemplates(dto.form ?? {}));
  }

  @Post('verbal/texto')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Converte um texto colado para o tempo futuro + ortografia' })
  async converterVerbalTexto(@Body() dto: ConverterVerbalTextoDto) {
    return new ApiEnvelope(await this.legado.converterVerbalTexto(dto.texto));
  }

  @Post('verbal/docx')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Corrige tempo verbal + ortografia de um .docx, preservando o layout' })
  async converterVerbalDocx(@UploadedFile() arquivo: Express.Multer.File | undefined) {
    if (!arquivo) throw new UnprocessableEntityException('Envie um arquivo .docx.');
    return new ApiEnvelope(await this.legado.converterVerbalDocx(arquivo.buffer, arquivo.originalname));
  }

  @Post('form-modulos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera o Levantamento ou o Check List a partir dos módulos selecionados' })
  async formModulos(@Body() dto: FormModulosDto) {
    return new ApiEnvelope(await this.legado.formModulos(dto.tipo, dto.form ?? {}, dto.modulos ?? []));
  }

  @Post('importar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Importa o Levantamento (.docx) e gera em sequência Projeto + Check List + Termo',
  })
  async importar(@UploadedFile() arquivo: Express.Multer.File | undefined) {
    if (!arquivo) throw new UnprocessableEntityException('Envie o arquivo .docx do Levantamento.');
    return new ApiEnvelope(await this.legado.importarSequencia(arquivo.buffer, arquivo.originalname));
  }

  @Post('gerar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('yaml'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Roda um gerador (tipo "gerar" de roles.py) com YAML opcional (upload ou cliente salvo)' })
  async gerar(@Body() dto: GerarDto, @UploadedFile() yaml: Express.Multer.File | undefined) {
    const yamlBasename = await this.legado.resolverYamlBase(
      yaml?.buffer ?? null,
      yaml?.originalname ?? null,
      dto.clienteArquivo,
    );
    return new ApiEnvelope(await this.legado.gerar(dto.mod, yamlBasename));
  }

  @Get('baixar/:token')
  @ApiOperation({ summary: 'Baixa um arquivo gerado por uma das ações acima' })
  baixar(@Param('token') token: string, @Res() res: Response) {
    this.legado.baixar(token, res);
  }
}
