import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BuscaWalleService } from './busca-walle.service';
import { PerguntarWalleDto, PesquisarWalleDto } from './dto/pesquisar-walle.dto';
import { WalleIaService } from './walle-ia.service';
import { WalleService } from './walle.service';

/** Tela **Execução → Wall-e** — base de conhecimento pesquisável sobre o acervo documental
 * dos chats do bot Wall-e (`R:\GRM\CHAT_WALLE\`, fonte SOMENTE LEITURA indexada no banco
 * do Painel). Gate pelo menu `walle`: consulta basta para pesquisar/abrir; `alteracao`
 * (ADM) é exigida só para reindexar o acervo. */
@ApiTags('walle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('walle')
@Controller('walle')
export class WalleController {
  constructor(
    private readonly servico: WalleService,
    private readonly busca: BuscaWalleService,
    private readonly ia: WalleIaService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Estado do acervo indexado (contagens, última atualização, cobertura SICLA)',
  })
  async status() {
    return new ApiEnvelope(await this.servico.status());
  }

  @Post('atualizar')
  @Permissao('walle', 'alteracao')
  @ApiOperation({
    summary:
      'Sincroniza o índice com a fonte (somente leitura na fonte; escrita só nas tabelas walle_*)',
  })
  async atualizar() {
    return new ApiEnvelope(await this.servico.atualizar());
  }

  @Get('busca')
  @ApiOperation({
    summary: 'Busca híbrida no acervo (identificadores + lexical + expansão semântica)',
  })
  async pesquisar(@Query() query: PesquisarWalleDto) {
    return new ApiEnvelope(await this.busca.pesquisar(query));
  }

  @Get('pergunta')
  @ApiOperation({
    summary:
      'Pergunta em linguagem natural: busca + síntese por IA (provedor local; degrada para fontes)',
  })
  async perguntar(
    @Query() query: PerguntarWalleDto,
    @Req() req: { user?: { email?: string } },
  ) {
    return new ApiEnvelope(await this.ia.perguntar(query.q, req.user?.email));
  }

  @Get('chats')
  @ApiOperation({ summary: 'Chats do acervo (com metadados do SICLA quando enriquecidos)' })
  async chats() {
    return new ApiEnvelope(await this.servico.listarChats());
  }

  @Get('chats/:codigo')
  @ApiOperation({
    summary: 'Visão completa de um chat: arquivos, assuntos, entidades e chats relacionados',
  })
  async chat(@Param('codigo', ParseIntPipe) codigo: number) {
    return new ApiEnvelope(await this.servico.visaoChat(codigo));
  }

  @Get('arquivos/:id')
  @ApiOperation({ summary: 'Documento completo (texto extraído + classificação + contexto)' })
  async arquivo(@Param('id', ParseIntPipe) id: number) {
    return new ApiEnvelope(await this.servico.arquivo(id));
  }

  @Get('arquivos/:id/imagem')
  @ApiOperation({
    summary: 'Bytes de uma imagem do acervo, lidos da fonte (somente leitura) na hora',
  })
  async imagem(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const { dados, mime, nome } = await this.servico.imagem(id);
    return new StreamableFile(dados, {
      type: mime,
      disposition: `inline; filename="${encodeURIComponent(nome)}"`,
    });
  }
}
