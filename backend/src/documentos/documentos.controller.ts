import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { AdicionarNotaDto } from './dto/adicionar-nota.dto';
import { DocumentosService } from './documentos.service';
import {
  GeracaoLayoutService,
  SlugDocumentoFiel,
} from './geracao-layout.service';
import { GeracaoDocumentosService } from '../geracao/geracao-documentos.service';
import { LegadoCliService } from '../legado/legado-cli.service';
import { LevantamentoRespostaService } from '../levantamento/levantamento-resposta.service';
import {
  NotificacaoService,
  EventoNotificacao,
} from '../email/notificacao.service';
import {
  Perfil,
  PERFIS_GERA_CRONOGRAMA,
  PERFIS_GERA_LEVANTAMENTO,
  temPapel,
} from '../common/constants/perfis';

const _SLUGS_DOCX: readonly SlugDocumentoFiel[] = [
  'levantamento',
  'projeto',
  'cronograma',
  'termo',
];

// Espelha webapp/app.py:_EVT_DOC — slug do documento gerado -> evento de notificação.
const _EVT_DOC: Record<SlugDocumentoFiel, EventoNotificacao> = {
  levantamento: 'levantamento_ok',
  projeto: 'projeto_ok',
  cronograma: 'cronograma_ok',
  termo: 'termo_ok',
};

// Espelha webapp/app.py:_GERA — quem pode gerar cada slug (checado no handler, não em
// @Roles estático, porque o gate depende do :slug do path, não é fixo por rota).
const _PERFIS_GERA: Record<SlugDocumentoFiel, Perfil[]> = {
  levantamento: PERFIS_GERA_LEVANTAMENTO,
  projeto: PERFIS_GERA_LEVANTAMENTO,
  cronograma: PERFIS_GERA_CRONOGRAMA,
  termo: PERFIS_GERA_CRONOGRAMA,
};

/**
 * O `PermissaoGuard` entra aqui, mas SEM `@Permissao` no nível da classe: as rotas de
 * LEITURA (listar, baixar, preview) têm de continuar abertas a quem só tem consulta — é
 * exigência explícita do processo ("download liberado a quem só tem consulta", ver
 * `RN - Passos do Processo de Implantação`). Rota sem `@Permissao` passa direto pelo guard,
 * então as de ESCRITA declaram `@Permissao('carteira', 'alteracao')` uma a uma.
 *
 * Antes de 2026-08-05 não havia guard nenhum: `POST projetos/:id/anexar` aceitava o `tipo`
 * cru do corpo e qualquer autenticado fechava, de forma irreversível, o passo de um projeto
 * alheio. O gate de RN-10 também é aplicado em `DocumentosService.registrarDocumento`.
 */
@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller()
export class DocumentosController {
  constructor(
    private readonly documentos: DocumentosService,
    private readonly geracaoLayout: GeracaoLayoutService,
    private readonly notificacao: NotificacaoService,
    private readonly geracaoDocumentos: GeracaoDocumentosService,
    private readonly legadoCli: LegadoCliService,
    private readonly levantamentoResposta: LevantamentoRespostaService,
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

  @Get('projetos/:projetoId/cabecalho')
  @ApiOperation({
    summary:
      'Stepper, gates, próxima ação e KPIs da ficha do projeto (qualquer projeto, não só o "em foco" da Home)',
  })
  async cabecalho(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return new ApiEnvelope(await this.documentos.cabecalho(projetoId));
  }

  @Post('projetos/:projetoId/avancar')
  @HttpCode(HttpStatus.OK)
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary:
      'Avança a etapa do projeto (exige que o gate da etapa atual esteja OK)',
  })
  async avancar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @CurrentUser() user: AuthUser,
  ) {
    const projeto = await this.documentos.avancarEtapa(projetoId, user.nome);
    return new ApiEnvelope(projeto, 'Etapa avançada.');
  }

  @Post('projetos/:projetoId/nota')
  @HttpCode(HttpStatus.OK)
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary: 'Adiciona uma anotação manual na timeline do projeto',
  })
  async adicionarNota(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: AdicionarNotaDto,
    @CurrentUser() user: AuthUser,
  ) {
    const evento = await this.documentos.adicionarNota(
      projetoId,
      dto.nota,
      user.nome,
    );
    return new ApiEnvelope(evento, 'Nota registrada.');
  }

  @Post('projetos/:projetoId/anexar')
  @Permissao('carteira', 'alteracao')
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Anexa um documento manualmente à ficha do projeto',
  })
  async anexar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body('tipo') tipo: string | undefined,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!arquivo)
      throw new UnprocessableEntityException(
        'Selecione um arquivo para anexar.',
      );
    // `user` vai adiante porque o `tipo` vem do CORPO, escolhido por quem envia: sem ele,
    // rotular o arquivo de `checklist` fechava o passo 14 de um projeto alheio (RN-10).
    const doc = await this.documentos.anexarDocumento(
      projetoId,
      tipo ?? 'outro',
      arquivo.originalname,
      arquivo.buffer,
      user,
    );
    return new ApiEnvelope(doc, 'Documento anexado.');
  }

  @Delete('documentos/:id')
  @Permissao('carteira', 'alteracao')
  @ApiOperation({
    summary:
      'Exclui um documento (só se nada posterior no fluxo depender dele)',
  })
  async excluirDocumento(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    await this.documentos.excluirDocumento(id, user.nome);
    return new ApiEnvelope(null, 'Documento excluído.');
  }

  @Get('documentos/:id/baixar')
  @ApiOperation({ summary: 'Baixa um documento gerado/anexado' })
  async baixar(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.documentos.buscarDocumento(id);
    if (!doc || !existsSync(doc.caminho))
      throw new NotFoundException('Documento não encontrado.');
    res.download(doc.caminho, doc.arquivo);
  }

  @Get('documentos/:id/preview')
  @ApiOperation({
    summary:
      'Pré-visualização WYSIWYG: PDF fiel (application/pdf) quando o Word converte o .docx, ' +
      'senão JSON { tipo: "html", html } — equivalente a webapp/routes_fluxo.py:projeto_doc_ver',
  })
  async preview(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.documentos.buscarDocumento(id);
    if (!doc || !existsSync(doc.caminho))
      throw new NotFoundException('Documento não encontrado.');
    const cabecalhos = {
      'X-Documento-Arquivo': encodeURIComponent(doc.arquivo),
      'X-Documento-Tipo': encodeURIComponent(doc.tipo),
    };
    const resultado = await this.geracaoDocumentos.preview(doc.caminho);
    if (resultado.tipo === 'pdf') {
      res.set({ ...cabecalhos, 'Content-Type': 'application/pdf' });
      res.send(resultado.buffer);
      return;
    }
    res.set(cabecalhos);
    res.json({ tipo: 'html', html: resultado.html });
  }

  @Get('projetos/:projetoId/projeto/origem')
  @ApiOperation({
    summary:
      'Estado da seleção de fonte do Projeto — há um Levantamento (.docx) importado neste projeto?',
  })
  async origemProjeto(@Param('projetoId', ParseIntPipe) projetoId: number) {
    const doc = await this.documentos.ultimoLevantamentoImportado(projetoId);
    return new ApiEnvelope({
      importado: doc ? { arquivo: doc.arquivo, criadoEm: doc.criadoEm } : null,
    });
  }

  @Post('projetos/:projetoId/projeto/importar-levantamento')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('arquivo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Importa as respostas de um Levantamento (.docx enviado agora, ou o último já importado) e gera o Projeto — ' +
      'equivalente a webapp/routes_geracao.py:projeto_origem (fontes "importar"/"importado")',
  })
  async importarLevantamentoEGerarProjeto(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!temPapel(user, ..._PERFIS_GERA.projeto)) {
      throw new ForbiddenException(
        'Seu perfil não pode gerar o Projeto de Implantação.',
      );
    }
    let caminhoDocx: string;
    if (arquivo) {
      if (!arquivo.originalname.toLowerCase().endsWith('.docx')) {
        throw new UnprocessableEntityException(
          'O Levantamento importado deve ser um arquivo .docx.',
        );
      }
      const salvoDocx = this.documentos.salvarArquivoGerado(
        projetoId,
        arquivo.originalname,
        arquivo.buffer,
      );
      await this.documentos.registrarDocumento(
        projetoId,
        'levantamento',
        salvoDocx.arquivo,
        salvoDocx.caminho,
        'importado',
        user.nome,
        { usuario: user },
      );
      await this.documentos.registrarEvento(
        projetoId,
        'documento',
        `Importou Levantamento ${salvoDocx.arquivo}`,
        user.nome,
      );
      caminhoDocx = salvoDocx.caminho;
    } else {
      const anterior =
        await this.documentos.ultimoLevantamentoImportado(projetoId);
      if (!anterior || !existsSync(anterior.caminho)) {
        throw new UnprocessableEntityException(
          'Não há Levantamento importado neste projeto.',
        );
      }
      caminhoDocx = anterior.caminho;
    }

    const { paragrafos } = await this.legadoCli.executar<{
      paragrafos: string[];
    }>('docx_paragrafos', {
      caminho: caminhoDocx,
    });
    const respondidas = await this.levantamentoResposta.importarDeParagrafos(
      projetoId,
      paragrafos,
    );

    const gerado = await this.geracaoLayout.gerar(projetoId, 'projeto', 'auto');
    const salvo = this.documentos.salvarArquivoGerado(
      projetoId,
      gerado.filename,
      gerado.buffer,
    );
    await this.documentos.registrarDocumento(
      projetoId,
      'projeto',
      salvo.arquivo,
      salvo.caminho,
      'gerado',
      user.nome,
      { usuario: user },
    );
    await this.documentos.registrarEvento(
      projetoId,
      'documento',
      `Gerou ${salvo.arquivo} pelo layout oficial (projeto) — ${respondidas} resposta(s) importada(s) do Levantamento`,
      user.nome,
    );
    await this.notificacao.notificarEvento(projetoId, _EVT_DOC.projeto);

    res.set({
      'Content-Type': gerado.contentType,
      'Content-Disposition': `attachment; filename="${gerado.filename}"`,
      'X-Respostas-Importadas': String(respondidas),
    });
    res.send(gerado.buffer);
  }

  @Post('projetos/:projetoId/gerar-layout/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gera o Levantamento, Projeto, Cronograma (.xlsx) ou Termo (.docx) pelo layout fiel vigente e anexa ao projeto',
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
        'slug inválido — use levantamento, projeto, cronograma ou termo.',
      );
    }
    if (!temPapel(user, ..._PERFIS_GERA[slug as SlugDocumentoFiel])) {
      throw new ForbiddenException('Seu perfil não pode gerar este documento.');
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
      user.nome,
      // `modo=modelo` é o layout EM BRANCO, para preencher à mão — não fecha passo.
      // `usuario` faz a conclusão respeitar a RN-10: o perfil autoriza GERAR o documento
      // (o Administrativo precisa poder baixar o Termo), mas concluir o passo é de quem
      // está designado NAQUELE projeto.
      { usuario: user, concluiPasso: modo !== 'modelo' },
    );
    const rotulo =
      `Gerou ${arquivo.filename} pelo layout oficial (${slug})` +
      (modo === 'modelo' ? ' — modelo p/ preenchimento manual' : '');
    await this.documentos.registrarEvento(
      projetoId,
      'documento',
      rotulo,
      user.nome,
    );
    // Notifica a Coordenação — mesmo gatilho de webapp/app.py:_EVT_DOC.
    await this.notificacao.notificarEvento(
      projetoId,
      _EVT_DOC[slug as SlugDocumentoFiel],
    );

    res.set({
      'Content-Type': arquivo.contentType,
      'Content-Disposition': `attachment; filename="${arquivo.filename}"`,
    });
    res.send(arquivo.buffer);
  }
}
