import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { LIMITE_UPLOAD_DOC } from '../common/upload.constants';
import { MENU_CONTROLE_ATIVIDADES } from './controle-atividades.constants';
import { ControleAtividadesService } from './controle-atividades.service';
import { QuadrosService } from './quadros.service';
import { ListasService } from './listas.service';
import { CartoesService } from './cartoes.service';
import { AnexosService } from './anexos.service';
import { BuscaService } from './busca.service';
import { NotificacoesAtividadeService } from './notificacoes-atividade.service';
import { ImportacaoTrelloService } from './importacao/importacao-trello.service';
import { ImportarTrelloDto } from './dto/importacao-trello.dto';
import { ClientesSiclaService } from '../clientes-sicla/clientes-sicla.service';
import { ContatosSiclaService } from '../contatos-sicla/contatos-sicla.service';
import {
  AbrirQuadroDto,
  ComentarioDto,
  CriarCartaoDto,
  CriarListaDto,
  EditarCartaoDto,
  EditarListaDto,
  ItemChecklistDto,
  LinkDto,
  MarcarItemDto,
  MarcarLidasDto,
  MembroDto,
  MoverCartaoDto,
  ResponsavelDto,
  VisibilidadeDto,
} from './dto/controle-atividades.dto';

/** Execução → Controle de Atividades (docs/controle-atividades.md).
 *
 * O gate de TELA é `@Permissao(MENU_CONTROLE_ATIVIDADES)`, em `consulta`: a leitura é geral
 * — todo usuário interno alcança todos os quadros. O que separa escrita de consulta NÃO é
 * este decorator, e sim ser responsável pelo quadro; isso é decidido nos services, por
 * quadro, porque o menu não sabe de quem é cada um.
 *
 * Camada de ENTRADA apenas (Guia Mestre §Responsabilidades): rota, guard, validação de DTO e
 * envelope. Nada de regra, nada de persistência. */
@ApiTags('controle-atividades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao(MENU_CONTROLE_ATIVIDADES)
@Controller('atividades')
export class ControleAtividadesController {
  constructor(
    private readonly atividades: ControleAtividadesService,
    private readonly quadros: QuadrosService,
    private readonly listas: ListasService,
    private readonly cartoes: CartoesService,
    private readonly anexos: AnexosService,
    private readonly busca: BuscaService,
    private readonly avisos: NotificacoesAtividadeService,
    private readonly importacao: ImportacaoTrelloService,
    private readonly clientesSicla: ClientesSiclaService,
    private readonly contatosSicla: ContatosSiclaService,
  ) {}

  // ------------------------------------------------------------------ quadros

  @Get('quadros')
  @ApiOperation({
    summary: 'Rail de clientes: meus, demais e os consultores para filtrar',
  })
  async listarQuadros(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.quadros.listar(user));
  }

  @Get('projetos-disponiveis')
  @ApiOperation({
    summary: 'Projetos em que estou designado e posso abrir quadro',
  })
  async projetosDisponiveis(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.quadros.projetosDisponiveis(user));
  }

  @Post('quadros')
  @ApiOperation({
    summary: 'Abre o quadro de um cliente (a partir de um projeto designado)',
  })
  async abrirQuadro(
    @CurrentUser() user: AuthUser,
    @Body() dto: AbrirQuadroDto,
  ) {
    return new ApiEnvelope(
      await this.quadros.abrir(
        user,
        dto.codigoClienteSicla,
        dto.nomeCliente,
        dto.projetoId ?? null,
      ),
    );
  }

  @Get('quadros/:codigo')
  @ApiOperation({
    summary:
      'Quadro inteiro: colunas, cartões, membros, checklist, anexos e conversa',
  })
  async quadro(@CurrentUser() user: AuthUser, @Param('codigo') codigo: string) {
    return new ApiEnvelope(await this.atividades.quadroCompleto(user, codigo));
  }

  @Post('quadros/:codigo/responsaveis')
  @ApiOperation({ summary: 'Inclui um consultor como responsável pelo quadro' })
  async incluirResponsavel(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
    @Body() dto: ResponsavelDto,
  ) {
    await this.quadros.incluirResponsavel(user, codigo, dto.usuarioId);
    return new ApiEnvelope(null, 'Responsável incluído.');
  }

  @Delete('quadros/:codigo/responsaveis/:usuarioId')
  @ApiOperation({ summary: 'Remove um responsável (nunca o último)' })
  async removerResponsavel(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
    @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    await this.quadros.removerResponsavel(user, codigo, usuarioId);
    return new ApiEnvelope(null, 'Responsável removido.');
  }

  @Post('quadros/:codigo/responsaveis/sincronizar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Repuxa a designação do projeto para os responsáveis do quadro',
  })
  async sincronizarResponsaveis(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
  ) {
    const n = await this.quadros.sincronizarResponsaveis(user, codigo);
    return new ApiEnvelope({ responsaveis: n }, 'Designação sincronizada.');
  }

  // ------------------------------------------------------------------ colunas

  @Post('quadros/:codigo/listas')
  @ApiOperation({ summary: 'Cria uma coluna no quadro' })
  async criarLista(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
    @Body() dto: CriarListaDto,
  ) {
    return new ApiEnvelope(
      await this.listas.criar(
        user,
        codigo,
        dto.titulo,
        dto.visivelCliente ?? true,
      ),
    );
  }

  @Patch('listas/:id')
  @ApiOperation({ summary: 'Renomeia a coluna ou muda se o cliente a enxerga' })
  async editarLista(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarListaDto,
  ) {
    return new ApiEnvelope(await this.listas.editar(user, id, dto));
  }

  @Delete('listas/:id')
  @ApiOperation({ summary: 'Arquiva a coluna (só vazia)' })
  async arquivarLista(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.listas.arquivar(user, id);
    return new ApiEnvelope(null, 'Coluna removida.');
  }

  // ------------------------------------------------------------------ cartões

  @Post('cartoes')
  @ApiOperation({
    summary: 'Cria um cartão (interno pela Rech; solicitação pelo cliente)',
  })
  async criarCartao(
    @CurrentUser() user: AuthUser,
    @Body() dto: CriarCartaoDto,
  ) {
    return new ApiEnvelope(await this.cartoes.criar(user, dto));
  }

  @Patch('cartoes/:id')
  @ApiOperation({ summary: 'Edita título, descrição, prazo e etiquetas' })
  async editarCartao(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarCartaoDto,
  ) {
    return new ApiEnvelope(await this.cartoes.editar(user, id, dto));
  }

  @Patch('cartoes/:id/mover')
  @ApiOperation({
    summary: 'Move o cartão de coluna/posição (ordem por ponto médio)',
  })
  async moverCartao(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoverCartaoDto,
  ) {
    return new ApiEnvelope(
      await this.cartoes.mover(user, id, dto.listaId, dto.indice),
    );
  }

  @Patch('cartoes/:id/visibilidade')
  @ApiOperation({ summary: 'Compartilha o cartão com o cliente, ou recolhe' })
  async visibilidade(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VisibilidadeDto,
  ) {
    return new ApiEnvelope(
      await this.cartoes.definirVisibilidade(user, id, dto.visivelCliente),
    );
  }

  @Delete('cartoes/:id')
  @ApiOperation({ summary: 'Arquiva o cartão' })
  async arquivarCartao(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.cartoes.arquivar(user, id);
    return new ApiEnvelope(null, 'Cartão arquivado.');
  }

  // ------------------------------------------------------------------ membros

  @Post('cartoes/:id/membros')
  @ApiOperation({
    summary: 'Inclui membro (cliente designa apenas consultor da Rech)',
  })
  async incluirMembro(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MembroDto,
  ) {
    return new ApiEnvelope(await this.cartoes.incluirMembro(user, id, dto));
  }

  @Delete('cartoes/:id/membros/:membroId')
  @ApiOperation({ summary: 'Remove membro do cartão' })
  async removerMembro(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('membroId', ParseIntPipe) membroId: number,
  ) {
    await this.cartoes.removerMembro(user, id, membroId);
    return new ApiEnvelope(null, 'Membro removido.');
  }

  // ---------------------------------------------------------------- checklist

  @Post('cartoes/:id/checklist')
  @ApiOperation({ summary: 'Acrescenta item ao checklist' })
  async incluirItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ItemChecklistDto,
  ) {
    return new ApiEnvelope(await this.cartoes.incluirItem(user, id, dto.texto));
  }

  @Patch('cartoes/:id/checklist/:itemId')
  @ApiOperation({ summary: 'Marca/desmarca um item (registra quem marcou)' })
  async marcarItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: MarcarItemDto,
  ) {
    return new ApiEnvelope(
      await this.cartoes.marcarItem(user, id, itemId, dto.feito),
    );
  }

  @Delete('cartoes/:id/checklist/:itemId')
  @ApiOperation({ summary: 'Remove item do checklist' })
  async removerItem(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    await this.cartoes.removerItem(user, id, itemId);
    return new ApiEnvelope(null, 'Item removido.');
  }

  // ------------------------------------------------------------------- anexos

  @Post('cartoes/:id/anexos')
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_UPLOAD_DOC } }),
  )
  @ApiOperation({ summary: 'Anexa arquivo ou foto ao cartão' })
  async anexar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile()
    arquivo: {
      originalname: string;
      buffer: Buffer;
      mimetype?: string;
      size?: number;
    },
  ) {
    return new ApiEnvelope(await this.anexos.anexar(user, id, arquivo));
  }

  @Post('cartoes/:id/anexos/link')
  @ApiOperation({ summary: 'Anexa um link ao cartão' })
  async anexarLink(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LinkDto,
  ) {
    return new ApiEnvelope(
      await this.anexos.anexarLink(user, id, dto.url, dto.nome),
    );
  }

  @Get('cartoes/:id/anexos/:anexoId')
  @ApiOperation({
    summary: 'Baixa o anexo (permissão do cartão reconferida aqui)',
  })
  async baixarAnexo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('anexoId', ParseIntPipe) anexoId: number,
    @Res() res: Response,
  ) {
    const a = await this.anexos.paraDownload(user, id, anexoId);
    res.type(a.mime);
    // `attachment` explícito: sem isso, um HTML ou SVG anexado abriria NA ORIGEM do Painel,
    // com acesso ao cookie/sessão de quem clicou.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
    );
    res.sendFile(a.caminho);
  }

  @Delete('cartoes/:id/anexos/:anexoId')
  @ApiOperation({ summary: 'Remove o anexo' })
  async removerAnexo(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('anexoId', ParseIntPipe) anexoId: number,
  ) {
    await this.anexos.remover(user, id, anexoId);
    return new ApiEnvelope(null, 'Anexo removido.');
  }

  // -------------------------------------------------------------- comentários

  @Post('cartoes/:id/comentarios')
  @ApiOperation({ summary: 'Comenta no cartão (avisa o outro lado)' })
  async comentar(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ComentarioDto,
  ) {
    return new ApiEnvelope(await this.cartoes.comentar(user, id, dto.texto));
  }

  // -------------------------------------------------------------------- busca

  @Get('busca')
  @ApiOperation({
    summary: 'Consulta geral de cartões em todos os quadros que eu alcanço',
  })
  async buscar(
    @CurrentUser() user: AuthUser,
    @Query('termo') termo: string,
    @Query('consultor') consultor?: string,
  ) {
    const id = Number(consultor);
    return new ApiEnvelope(
      await this.busca.buscar(
        user,
        termo ?? '',
        Number.isFinite(id) && id > 0 ? id : undefined,
      ),
    );
  }

  // ------------------------------------------------------------------- avisos

  @Get('notificacoes')
  @ApiOperation({
    summary: 'Avisos pendentes (o pop-up do canto inferior direito)',
  })
  async notificacoes(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope(await this.avisos.pendentes(user.sub));
  }

  @Post('notificacoes/lidas')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fecha avisos (sem ids, fecha todos)' })
  async marcarLidas(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarcarLidasDto,
  ) {
    if (dto.ids?.length) await this.avisos.marcarLidas(user.sub, dto.ids);
    else await this.avisos.marcarTodasLidas(user.sub);
    return new ApiEnvelope(null, 'Avisos fechados.');
  }

  // -------------------------------------------------------- importar do Trello

  @Post('quadros/:codigo/importar/trello/previa')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_UPLOAD_DOC } }),
  )
  @ApiOperation({
    summary:
      'Lê a exportação JSON do Trello e mostra o que entraria — NÃO grava nada',
  })
  async previaTrello(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
    @UploadedFile() arquivo: { buffer?: Buffer },
  ) {
    return new ApiEnvelope(
      await this.importacao.previa(user, codigo, conteudoDe(arquivo)),
    );
  }

  @Post('quadros/:codigo/importar/trello')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_UPLOAD_DOC } }),
  )
  @ApiOperation({
    summary: 'Importa o quadro do Trello — cartões entram INTERNOS',
  })
  async importarTrello(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
    @UploadedFile() arquivo: { buffer?: Buffer },
    @Body() dto: ImportarTrelloDto,
  ) {
    const destinos = destinosDe(dto.destinos);
    return new ApiEnvelope(
      await this.importacao.importar(
        user,
        codigo,
        conteudoDe(arquivo),
        destinos,
      ),
      'Importação concluída.',
    );
  }

  // ------------------------------------------------------------------ apoio

  @Get('etiquetas')
  @ApiOperation({ summary: 'Catálogo fixo de etiquetas' })
  etiquetas() {
    return new ApiEnvelope(this.atividades.etiquetas());
  }

  @Get('consultores')
  @ApiOperation({
    summary:
      'Quem da Rech atende ESTE cliente (designados do projeto + responsáveis)',
  })
  async consultores(
    @CurrentUser() user: AuthUser,
    // Obrigatório desde 2026-09-03: sem o quadro, isto devolvia o cadastro inteiro de
    // usuários internos, e o seletor de designado virava uma lista telefônica da empresa.
    @Query('codigo') codigo: string,
  ) {
    return new ApiEnvelope(await this.atividades.consultores(user, codigo));
  }

  @Get('clientes')
  @ApiOperation({ summary: 'Busca de cliente no SICLA (API de Dados)' })
  async clientes(@Query('termo') termo: string) {
    return new ApiEnvelope(await this.clientesSicla.buscar(termo ?? ''));
  }

  @Get('contatos/:codigo')
  @ApiOperation({ summary: 'Contatos do cliente no SICLA (API de Dados)' })
  async contatos(
    @CurrentUser() user: AuthUser,
    @Param('codigo') codigo: string,
  ) {
    // Passa pelo mesmo gate do quadro: listar os contatos de um cliente é dado de cliente, e
    // não pode ser um atalho para quem não alcança o quadro dele.
    await this.quadros.exigirLegivel(user, codigo);
    // `listarDoCliente`, não `listar`: aqui a pergunta é "quem são as pessoas deste cliente?"
    // (agenda), e não "quem pode ter conta no Painel?" (autorização). Enquanto isto chamava
    // `listar`, o seletor do cartão só oferecia quem tinha PORTAL_RECH_CLIENTES = 1.
    return new ApiEnvelope(await this.contatosSicla.listarDoCliente(codigo));
  }
}

/** Texto do arquivo enviado.
 *
 * O JSON do Trello é UTF-8; ler como tal (e não com a codificação padrão do sistema) é o que
 * preserva acento em título de cartão — que é a regra, não a exceção, num quadro em português. */
function conteudoDe(arquivo: { buffer?: Buffer } | undefined): string {
  const buffer = arquivo?.buffer;
  if (!buffer?.length) {
    throw new BadRequestException(
      'Envie o arquivo .json exportado do Trello (menu do quadro → Compartilhar → ' +
        'Exportar como JSON).',
    );
  }
  return buffer.toString('utf8');
}

/** De/para das listas, lido do campo de texto do multipart.
 *
 * Tolerante de propósito: o pior caso de um de/para ilegível é criar colunas novas em vez de
 * reaproveitar as existentes — irritante, mas reversível. Derrubar a importação inteira por
 * causa dele seria pior. */
function destinosDe(bruto: string | undefined): {
  idListaTrello: string;
  listaId: number | null;
}[] {
  if (!bruto?.trim()) return [];
  let lido: unknown;
  try {
    lido = JSON.parse(bruto);
  } catch {
    return [];
  }
  if (!Array.isArray(lido)) return [];
  return lido
    .map((d) => {
      const item = (d ?? {}) as Record<string, unknown>;
      const id =
        typeof item['idListaTrello'] === 'string' ? item['idListaTrello'] : '';
      const lista = Number(item['listaId']);
      return {
        idListaTrello: id,
        listaId: Number.isInteger(lista) && lista > 0 ? lista : null,
      };
    })
    .filter((d) => d.idListaTrello);
}
