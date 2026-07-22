import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { extname, join, resolve, sep } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ProtocolosService } from './protocolos.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { SalvarEdicaoProtocoloDto } from './dto/salvar-edicao-protocolo.dto';
import { ListarProtocolosDto } from './dto/listar-protocolos.dto';
import {
  EXTS,
  EXTS_AUDIO,
  EXTS_VIDEO,
  ehAudio,
  slug,
} from './protocolos.constants';

// Aprovar/reprovar é mais restrito que o resto da tela (qualquer autenticado pode listar/
// enviar/editar) — espelha webapp/routes_protocolos.py:_pode_aprovar.
const PERFIS_APROVA_PROTOCOLO = ['ADM', 'Coordenador'] as const;

/** Protocolos de Treinamento (/protocolos/*): base de conhecimento de vídeos
 * transcritos e analisados por IA. Espelha webapp/routes_protocolos.py. */
@ApiTags('protocolos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('protocolos')
export class ProtocolosController {
  constructor(
    private readonly protocolos: ProtocolosService,
    private readonly processamento: ProcessamentoProtocolosService,
    private readonly transcricao: TranscricaoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consulta da base de conhecimento, com filtros' })
  async listar(@Query() filtro: ListarProtocolosDto) {
    const itens = await this.protocolos.listar(filtro);
    return new ApiEnvelope({
      itens,
      roboOk: this.processamento.configurado(),
      pasta: this.processamento.pastaRaiz(),
    });
  }

  @Post('novo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('video'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload manual: salva o vídeo/áudio e dispara o pipeline de transcrição+IA',
  })
  async novo(
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo) {
      throw new UnprocessableEntityException(
        'Selecione um arquivo de vídeo ou áudio.',
      );
    }
    const ext = extname(arquivo.originalname).toLowerCase();
    if (!EXTS.includes(ext)) {
      throw new UnprocessableEntityException(
        `Formato não suportado (${ext}). Vídeo: ${EXTS_VIDEO.join(', ')} | Áudio: ${EXTS_AUDIO.join(', ')}`,
      );
    }
    const destDir = join(this.processamento.pastaRaiz(), 'Videos Pendentes');
    mkdirSync(destDir, { recursive: true });
    const base = arquivo.originalname.slice(0, -ext.length);
    let nome = slug(base) + ext;
    let caminho = join(destDir, nome);
    let n = 1;
    while (existsSync(caminho)) {
      nome = `${slug(base)}_${n}${ext}`;
      caminho = join(destDir, nome);
      n += 1;
    }
    writeFileSync(caminho, arquivo.buffer);

    const { id, novo } = await this.protocolos.criar(
      nome,
      caminho,
      'upload',
      user.nome,
    );
    if (!novo) {
      return new ApiEnvelope({
        id,
        novo,
        aviso: 'Este vídeo já foi registrado antes (mesmo conteúdo).',
      });
    }
    this.processamento.processarAsync(id, user.nome);
    return new ApiEnvelope({
      id,
      novo,
      aviso: 'Vídeo recebido — transcrição em andamento (acompanhe o status).',
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ficha de revisão: vídeo, transcrição e protocolo editável',
  })
  async ficha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const p = await this.protocolos.buscarPorId(id);
    return new ApiEnvelope({
      protocolo: p,
      podeAprovar: (PERFIS_APROVA_PROTOCOLO as readonly string[]).includes(
        user.perfil,
      ),
      ehAudio: ehAudio(p.videoNome),
    });
  }

  @Post(':id/salvar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva a edição humana dos campos de conteúdo' })
  async salvar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarEdicaoProtocoloDto,
    @CurrentUser() user: AuthUser,
  ) {
    const ok = await this.protocolos.salvarEdicao(id, dto, user.nome);
    if (!ok) throw new NotFoundException('Protocolo não encontrado.');
    return new ApiEnvelope({ salvo: true });
  }

  @Post(':id/processar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '(Re)processa o vídeo — transcreve e analisa de novo',
  })
  async processar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const p = await this.protocolos.buscarPorId(id);
    if (p.status === 'Transcrevendo' || p.status === 'Analisando') {
      return new ApiEnvelope({
        iniciado: false,
        aviso: 'Já está em processamento.',
      });
    }
    this.processamento.processarAsync(id, user.nome);
    return new ApiEnvelope({
      iniciado: true,
      aviso: 'Processamento iniciado em segundo plano.',
    });
  }

  @Post(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...PERFIS_APROVA_PROTOCOLO)
  @ApiOperation({ summary: 'Aprova — publica na base de conhecimento' })
  async aprovar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const ok = await this.protocolos.decidir(id, true, user.nome);
    if (!ok) throw new NotFoundException('Protocolo não encontrado.');
    return new ApiEnvelope({ salvo: true });
  }

  @Post(':id/reprovar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...PERFIS_APROVA_PROTOCOLO)
  @ApiOperation({ summary: 'Reprova — devolve para ajuste' })
  async reprovar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const ok = await this.protocolos.decidir(id, false, user.nome);
    if (!ok) throw new NotFoundException('Protocolo não encontrado.');
    return new ApiEnvelope({ salvo: true });
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Andamento do processamento — polling da tela de revisão',
  })
  async status(@Param('id', ParseIntPipe) id: number) {
    const p = await this.protocolos.buscar(id);
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    const out: {
      status: string;
      pct: number | null;
      pos: number;
      dur: number;
    } = { status: p.status, pct: null, pos: 0, dur: 0 };
    if (p.status === 'Transcrevendo') {
      const job = await this.transcricao.status(id);
      if (job && job.status === 'processando') {
        out.pct = job.pct;
        out.pos = job.pos;
        out.dur = job.dur;
      }
    }
    return new ApiEnvelope(out);
  }

  @Get(':id/video')
  @ApiOperation({
    summary: 'Serve o vídeo/áudio para o player da revisão (com Range)',
  })
  async video(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const p = await this.protocolos.buscar(id);
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    const caminho = resolve(p.videoCaminho || '');
    const raiz = resolve(this.processamento.pastaRaiz());
    if (
      !existsSync(caminho) ||
      !(caminho === raiz || caminho.startsWith(raiz + sep))
    ) {
      throw new ForbiddenException('Arquivo fora da pasta permitida.');
    }
    const tamanho = statSync(caminho).size;
    const range = res.req.headers.range;
    if (!range) {
      res.set({ 'Content-Length': String(tamanho), 'Accept-Ranges': 'bytes' });
      createReadStream(caminho).pipe(res);
      return;
    }
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) throw new BadRequestException('Cabeçalho Range inválido.');
    const inicio = match[1] ? parseInt(match[1], 10) : 0;
    const fim = match[2] ? parseInt(match[2], 10) : tamanho - 1;
    res.status(206);
    res.set({
      'Content-Range': `bytes ${inicio}-${fim}/${tamanho}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(fim - inicio + 1),
    });
    createReadStream(caminho, { start: inicio, end: fim }).pipe(res);
  }
}
