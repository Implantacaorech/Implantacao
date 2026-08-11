import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
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
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { temPapel } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { exigirAcessoProtocolo } from './protocolos.acesso';
import { aplicarNomes, lerMapa, locutoresDe } from './locutores';
import { JwtService } from '@nestjs/jwt';
import { ProtocolosService } from './protocolos.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { GravacaoProtocolosService } from './gravacao-protocolos.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { SalvarEdicaoProtocoloDto } from './dto/salvar-edicao-protocolo.dto';
import { ListarProtocolosDto } from './dto/listar-protocolos.dto';
import {
  FinalizarGravacaoDto,
  IniciarGravacaoDto,
  MapaLocutoresDto,
  TrechoGravacaoDto,
} from './dto/gravacao.dto';
import {
  EXTS,
  EXTS_AUDIO,
  EXTS_VIDEO,
  PERFIS_APROVA_PROTOCOLO,
  ehAudio,
  slug,
} from './protocolos.constants';

/** Protocolos de Treinamento (/protocolos/*): base de conhecimento de vídeos
 * transcritos e analisados por IA. Gate = todo o time de implantação, menos o Comercial
 * (definição do usuário em 2026-07-28). Aprovar/reprovar é mais restrito (ver métodos). */
@ApiTags('protocolos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Permissao('protocolos')
@Controller('protocolos')
export class ProtocolosController {
  constructor(
    private readonly protocolos: ProtocolosService,
    private readonly processamento: ProcessamentoProtocolosService,
    private readonly gravacao: GravacaoProtocolosService,
    private readonly transcricao: TranscricaoService,
    private readonly jwt: JwtService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Consulta da base de conhecimento, com filtros' })
  async listar(
    @Query() filtro: ListarProtocolosDto,
    @CurrentUser() user: AuthUser,
  ) {
    const itens = await this.protocolos.listar({
      ...filtro,
      // Cada um só enxerga o próprio material (+ a pasta do robô, que não tem dono) —
      // ver protocolos.acesso.ts. O recorte é feito AQUI, com o nome do token: mandar isso
      // pela tela deixaria qualquer um pedir a lista de outra pessoa.
      apenasDe: temPapel(user, 'ADM') ? undefined : user.nome,
    });
    return new ApiEnvelope({
      itens,
      roboOk: this.processamento.configurado(),
      pasta: this.processamento.pastaRaiz(),
      podeExcluir: temPapel(user, ...PERFIS_APROVA_PROTOCOLO),
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
    // O multer/busboy decodifica o nome do arquivo do multipart como latin-1, então um
    // upload de "Integrações.mp4" chega aqui como "IntegraÃ§Ãµes.mp4" e o slug produzia
    // "IntegraA_A_es". Reinterpretar os bytes como UTF-8 devolve o nome real. (O robô do
    // SharePoint nunca teve esse problema: lá o nome vem do sistema de arquivos.)
    const nomeOriginal = Buffer.from(arquivo.originalname, 'latin1').toString(
      'utf8',
    );
    const ext = extname(nomeOriginal).toLowerCase();
    if (!EXTS.includes(ext)) {
      throw new UnprocessableEntityException(
        `Formato não suportado (${ext}). Vídeo: ${EXTS_VIDEO.join(', ')} | Áudio: ${EXTS_AUDIO.join(', ')}`,
      );
    }
    const destDir = join(this.processamento.pastaRaiz(), 'Videos Pendentes');
    mkdirSync(destDir, { recursive: true });
    const base = nomeOriginal.slice(0, -ext.length);
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

  // ----------------------------------------------------- gravação de reunião ao vivo
  // Declaradas ANTES de @Get(':id')/@Post(':id/...') de propósito: o Nest resolve rotas na
  // ordem em que são declaradas, e 'clientes'/'gravacao' cairiam no ParseIntPipe do :id.

  @Get('clientes')
  @ApiOperation({
    summary:
      'Busca o cliente no SICLA (mesma consulta do Novo Cliente) para direcionar a gravação',
  })
  async clientes(@Query('termo') termo?: string) {
    return new ApiEnvelope(await this.gravacao.buscarClientes(termo ?? ''));
  }

  @Post('gravacao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Abre uma gravação de reunião (presencial ou Teams) e começa a transcrever ao vivo',
  })
  async iniciarGravacao(
    @Body() dto: IniciarGravacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.gravacao.iniciar(user, dto));
  }

  @Post('gravacao/:id/trecho')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Envia um trecho do áudio em andamento (WAV 16 kHz mono) para transcrição',
  })
  async trechoGravacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TrechoGravacaoDto,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo?.buffer?.length) {
      throw new UnprocessableEntityException('Trecho de áudio vazio.');
    }
    return new ApiEnvelope(
      await this.gravacao.trecho(id, dto.seq, arquivo.buffer, user),
    );
  }

  @Get('gravacao/:id')
  @ApiOperation({
    summary:
      'Andamento da gravação: texto transcrito até agora, duração e pendências',
  })
  async estadoGravacao(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.gravacao.estado(id, user));
  }

  @Post('gravacao/:id/finalizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Encerra a gravação, salva o áudio e dispara a análise de IA + resumo completo',
  })
  async finalizarGravacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalizarGravacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.gravacao.finalizar(id, user, dto));
  }

  @Delete('gravacao/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Descarta a gravação em andamento (áudio e registro)',
  })
  async cancelarGravacao(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.gravacao.cancelar(id, user);
    return new ApiEnvelope({ cancelado: true });
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
    exigirAcessoProtocolo(p, user);
    // A transcrição sai da API JÁ com os nomes aplicados; o texto gravado continua com os
    // rótulos P1/P2, para renomear seguir sendo reversível (ver locutores.ts).
    const mapa = lerMapa(p.mapaLocutores);
    const rotulos = locutoresDe(p.transcricao);
    return new ApiEnvelope({
      protocolo: { ...p, transcricao: aplicarNomes(p.transcricao, mapa) },
      /** Rótulos presentes na transcrição, na ordem em que falam — é o que a tela de
       * renomear pergunta. Vazio quando a gravação não separou vozes. */
      locutores: rotulos,
      mapaLocutores: mapa,
      // Todos os papéis do usuário, não só o principal (correção de 2026-07-28).
      podeAprovar: temPapel(user, ...PERFIS_APROVA_PROTOCOLO),
      // Mesma restrição de aprovar/reprovar (decisão do usuário em 2026-07-30).
      podeExcluir: temPapel(user, ...PERFIS_APROVA_PROTOCOLO),
      ehAudio: ehAudio(p.videoNome),
    });
  }

  @Post(':id/locutores')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Define os NOMES dos locutores (P1 -> Ivian) — não reescreve a transcrição',
  })
  async renomearLocutores(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MapaLocutoresDto,
    @CurrentUser() user: AuthUser,
  ) {
    const p = await this.protocolos.buscarPorId(id);
    exigirAcessoProtocolo(p, user);
    // Só aceita rótulos que EXISTEM na transcrição: evita encher o mapa de lixo (e deixa
    // claro na tela que renomear alguém que não falou não faz nada).
    const validos = new Set(locutoresDe(p.transcricao));
    const mapa: Record<string, string> = {};
    for (const [rotulo, nome] of Object.entries(dto.mapa ?? {})) {
      const chave = rotulo.trim().toUpperCase();
      const limpo = (nome ?? '').trim();
      if (validos.has(chave) && limpo) mapa[chave] = limpo.slice(0, 80);
    }
    await this.protocolos.atualizar(id, {
      mapaLocutores: JSON.stringify(mapa),
    });
    await this.protocolos.salvarHistorico(
      id,
      `Locutores nomeados: ${
        Object.entries(mapa)
          .map(([r, n]) => `${r}=${n}`)
          .join(', ') || '(limpo)'
      }.`,
      user.nome,
    );
    return new ApiEnvelope({
      mapaLocutores: mapa,
      transcricao: aplicarNomes(p.transcricao, mapa),
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
    exigirAcessoProtocolo(await this.protocolos.buscarPorId(id), user);
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
    exigirAcessoProtocolo(p, user);
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

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancela o processamento em andamento — mata a transcrição e destrava o protocolo',
  })
  async cancelar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    exigirAcessoProtocolo(await this.protocolos.buscarPorId(id), user);
    const r = await this.processamento.cancelar(id, user.nome);
    return new ApiEnvelope({ cancelado: r.ok, aviso: r.msg });
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
    exigirAcessoProtocolo(await this.protocolos.buscarPorId(id), user);
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
    exigirAcessoProtocolo(await this.protocolos.buscarPorId(id), user);
    const ok = await this.protocolos.decidir(id, false, user.nome);
    if (!ok) throw new NotFoundException('Protocolo não encontrado.');
    return new ApiEnvelope({ salvo: true });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(...PERFIS_APROVA_PROTOCOLO)
  @ApiOperation({
    summary: 'Exclui o registro e o arquivo de vídeo/áudio original',
  })
  async excluir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    exigirAcessoProtocolo(await this.protocolos.buscarPorId(id), user);
    // Antes de apagar a linha: mata a transcrição do lado do docservice e para o pipeline
    // em voo. Sem isto, excluir um protocolo em processamento deixava o transcritor moendo
    // o vídeo até o fim (377% de CPU em 2026-08-06) para entregar um resultado a um
    // registro que não existe mais — e o texto pronto ficava ocupando memória lá.
    await this.processamento.interromper(id);
    const p = await this.protocolos.excluir(id);
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    this.processamento.apagarArquivo(p.videoCaminho);
    return new ApiEnvelope({ excluido: true });
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Andamento do processamento — polling da tela de revisão',
  })
  async status(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const p = await this.protocolos.buscar(id);
    if (!p) throw new NotFoundException('Protocolo não encontrado.');
    exigirAcessoProtocolo(p, user);
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

  @Get(':id/video-ticket')
  @ApiOperation({
    summary:
      'Emite um ticket curto para o player buscar a mídia (ver ProtocolosMidiaController)',
  })
  async videoTicket(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const p = await this.protocolos.buscarPorId(id);
    exigirAcessoProtocolo(p, user);
    // Curto de propósito: o ticket viaja na URL do <video>, e URL vaza para log de
    // servidor, histórico e "copiar link". 10 min cobrem abrir e assistir; se expirar no
    // meio, a tela pede outro.
    const ticket = await this.jwt.signAsync(
      { pid: id, escopo: 'midia' },
      { expiresIn: '10m' },
    );
    return new ApiEnvelope({ ticket });
  }
}
