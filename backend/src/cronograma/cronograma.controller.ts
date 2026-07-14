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
  Put,
  Query,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  PERFIS_GERA_CRONOGRAMA,
  PERFIS_SISTEMA,
} from '../common/constants/perfis';
import {
  CronogramaService,
  serializarDiasExcluidos,
} from './cronograma.service';
import { DesignacoesService } from './designacoes.service';
import { DistribuicaoService } from './distribuicao.service';
import { AlocarAtividadeDto } from './dto/alocar-atividade.dto';
import { AlocarVisitaDto } from './dto/alocar-visita.dto';
import { HorarioDto } from './dto/horario.dto';
import { TecnicoModuloDto } from './dto/tecnico-modulo.dto';
import { ConfigDistribuicaoDto } from './dto/config-distribuicao.dto';
import { PeriodoBloqueadoCriarDto } from './dto/periodo-bloqueado.dto';
import { StatusDto } from './dto/status.dto';
import { PostergarDto, PostergarVisitaDto } from './dto/postergar.dto';
import { ReorganizarModuloDto } from './dto/reorganizar-modulo.dto';
import { AcompanhamentoQueryDto } from './dto/acompanhamento-query.dto';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { GeracaoDocumentosService } from '../geracao/geracao-documentos.service';
import { DocumentosService } from '../documentos/documentos.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GERA_CRONOGRAMA)
@Controller('projetos/:projetoId/agenda')
export class CronogramaController {
  constructor(
    private readonly cronograma: CronogramaService,
    private readonly designacoes: DesignacoesService,
    private readonly distribuicao: DistribuicaoService,
    private readonly geracao: GeracaoDocumentosService,
    private readonly documentos: DocumentosService,
  ) {}

  @Get('atividades')
  @ApiOperation({
    summary:
      'Lista as atividades do agendador (semeia do Check List na 1ª vez)',
  })
  async atividades(@Param('projetoId', ParseIntPipe) projetoId: number) {
    await this.cronograma.garantirSeed(projetoId);
    return this.cronograma.listarAtividades(projetoId);
  }

  @Get('visitas')
  @ApiOperation({ summary: 'Atividades agrupadas em Visitas (módulo+seq)' })
  async visitas(@Param('projetoId', ParseIntPipe) projetoId: number) {
    await this.cronograma.garantirSeed(projetoId);
    return this.cronograma.visitas(projetoId);
  }

  @Get('designacoes')
  @ApiOperation({ summary: 'Técnico/ordem de treinamento/analista por módulo' })
  designacoes_(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.designacoes.doProjeto(projetoId);
  }

  @Put('designacoes')
  @ApiOperation({
    summary: 'Define técnico/ordem/analista/"não distribuir" de um módulo',
  })
  async salvarDesignacao(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: TecnicoModuloDto,
  ) {
    const n = await this.designacoes.tecnicoModulo(
      projetoId,
      dto.modulo,
      dto.tecnico,
      {
        ordem: dto.ordem,
        naoDistribuir: dto.naoDistribuir,
        analista: dto.analista,
      },
    );
    return new ApiEnvelope({ cartoesAtualizados: n });
  }

  @Get('horarios')
  @ApiOperation({ summary: 'Horário global (início/fim) de cada turno' })
  horarios(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.cronograma.horarios(projetoId);
  }

  @Put('horarios')
  @ApiOperation({ summary: 'Define o horário global de um turno' })
  async salvarHorario(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: HorarioDto,
  ) {
    const r = await this.cronograma.horarioSalvar(
      projetoId,
      dto.turno,
      dto.horaInicio,
      dto.horaFim,
    );
    if (!r) throw new UnprocessableEntityException('Turno inválido.');
    return r;
  }

  @Get('config')
  @ApiOperation({
    summary:
      'Configuração da distribuição automática (modo, data início, dias excluídos, analista)',
  })
  config(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.cronograma.config(projetoId);
  }

  @Put('config')
  @ApiOperation({
    summary: 'Atualiza a configuração da distribuição automática',
  })
  configSalvar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: ConfigDistribuicaoDto,
  ) {
    return this.cronograma.configSalvar(projetoId, {
      modo: dto.modo,
      dataInicio: dto.dataInicio,
      diasTurnosExcluidos: dto.diasExcluidos
        ? serializarDiasExcluidos(dto.diasExcluidos)
        : undefined,
      analistaPadrao: dto.analistaPadrao,
    });
  }

  @Get('periodos')
  @ApiOperation({
    summary: 'Períodos sem agenda (recesso, férias coletivas etc.) do projeto',
  })
  periodos(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.cronograma.periodosBloqueados(projetoId);
  }

  @Post('periodos')
  @ApiOperation({
    summary: 'Cria um período sem agenda — vazio em técnicos vale para todos',
  })
  async criarPeriodo(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: PeriodoBloqueadoCriarDto,
  ) {
    const p = await this.cronograma.periodoBloqueadoCriar(
      projetoId,
      dto.dataIni,
      dto.dataFim,
      dto.motivo,
      dto.tecnicos,
    );
    if (!p)
      throw new UnprocessableEntityException(
        'Informe data início e fim válidas (fim não pode ser antes do início).',
      );
    return p;
  }

  @Delete('periodos/:periodoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exclui um período sem agenda' })
  async excluirPeriodo(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('periodoId', ParseIntPipe) periodoId: number,
  ) {
    const ok = await this.cronograma.periodoBloqueadoExcluir(
      periodoId,
      projetoId,
    );
    if (!ok) throw new NotFoundException('Período não encontrado.');
    return new ApiEnvelope(null, 'Período excluído');
  }

  @Get('prontidao')
  @ApiOperation({
    summary:
      'Módulos sem técnico válido (travam a distribuição) e se já houve visita Realizada',
  })
  prontidao(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.distribuicao.prontidao(projetoId);
  }

  @Post('alocar/:atividadeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aloca/desaloca uma atividade num slot (arrastar um cartão)',
  })
  async alocar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('atividadeId', ParseIntPipe) atividadeId: number,
    @Body() dto: AlocarAtividadeDto,
  ) {
    if (dto.data) {
      let tecnicoEfetivo = (dto.tecnico || '').trim();
      if (!tecnicoEfetivo) {
        const atual = (await this.cronograma.listarAtividades(projetoId)).find(
          (a) => a.id === atividadeId,
        );
        tecnicoEfetivo = (atual?.tecnico || '').trim();
        if (!tecnicoEfetivo) {
          const designacoes = await this.designacoes.doProjeto(projetoId);
          tecnicoEfetivo = (
            designacoes.find((d) => d.modulo === atual?.modulo)?.consultor || ''
          ).trim();
        }
      }
      const motivo = await this.cronograma.slotIndisponivel(
        dto.data,
        dto.turno || '',
        projetoId,
        tecnicoEfetivo,
      );
      if (motivo) throw new UnprocessableEntityException(motivo);
    }
    // toque manual (arrastar um cartão) tira a atividade da gestão da distribuição automática
    const auto = dto.data !== undefined ? false : undefined;
    const atualizado = await this.cronograma.alocar(atividadeId, projetoId, {
      ...dto,
      auto,
    });
    if (!atualizado) throw new NotFoundException('Atividade não encontrada.');
    return atualizado;
  }

  @Post('alocar-visita')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Aloca/realoca/desaloca a visita inteira (todas as atividades ainda em aberto)',
  })
  async alocarVisita(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: AlocarVisitaDto,
  ) {
    const desalocar = !dto.data && !dto.turno;
    const designacoes = await this.designacoes.doProjeto(projetoId);
    const consultor =
      designacoes.find((d) => d.modulo === dto.modulo)?.consultor || '';
    if (!desalocar) {
      const motivo = await this.cronograma.slotIndisponivel(
        dto.data || '',
        dto.turno || '',
        projetoId,
        consultor,
      );
      if (motivo) throw new UnprocessableEntityException(motivo);
    }
    const n = await this.cronograma.alocarVisita(
      projetoId,
      dto.modulo,
      dto.seq,
      dto.data || '',
      dto.turno || '',
      consultor,
    );
    return new ApiEnvelope({ n });
  }

  @Post('distribuir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Distribuição de agendas conforme datas livres (só pendentes)',
  })
  distribuir(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.distribuicao.distribuirAutomatico(projetoId);
  }

  @Post('redistribuir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refaz a distribuição automática (preserva alocação manual)',
  })
  redistribuir(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.distribuicao.redistribuir(projetoId);
  }

  @Post('desfazer-tudo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Desfaz TODAS as agendas (bloqueado se já houve visita Realizada/Não Realizada)',
  })
  desfazerTudo(@Param('projetoId', ParseIntPipe) projetoId: number) {
    return this.distribuicao.desfazerTudo(projetoId);
  }

  @Post('reorganizar-modulo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reorganiza as visitas ainda abertas de um módulo (após postergar um bloco)',
  })
  reorganizarModulo(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: ReorganizarModuloDto,
  ) {
    return this.distribuicao.reorganizarModulo(projetoId, dto.modulo);
  }

  @Put('atividades/:atividadeId/status')
  @ApiOperation({ summary: 'Define o status de uma atividade' })
  async status(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('atividadeId', ParseIntPipe) atividadeId: number,
    @Body() dto: StatusDto,
  ) {
    const atualizado = await this.cronograma.status(
      atividadeId,
      projetoId,
      dto.status,
    );
    if (!atualizado)
      throw new UnprocessableEntityException(
        'Status inválido ou atividade não encontrada.',
      );
    return atualizado;
  }

  @Post('postergar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Posterga assunto(s) — por atividade ou por turno inteiro',
  })
  async postergar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: PostergarDto,
  ) {
    const n = await this.cronograma.postergarLote(
      projetoId,
      { atividadeId: dto.atividadeId, data: dto.data, turno: dto.turno },
      dto.novaData,
      dto.novoTurno,
    );
    return new ApiEnvelope({ n });
  }

  @Post('postergar-visita')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Posterga a visita (bloco) inteira para uma nova data/turno',
  })
  async postergarVisita(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Body() dto: PostergarVisitaDto,
  ) {
    const n = await this.cronograma.postergarVisita(
      projetoId,
      dto.modulo,
      dto.seq,
      dto.novaData,
      dto.novoTurno,
    );
    if (!n)
      throw new UnprocessableEntityException(
        'Nada para postergar (a visita não está alocada ou já foi tratada).',
      );
    return new ApiEnvelope({ n });
  }

  @Delete('atividades/:atividadeId')
  @Roles(...PERFIS_SISTEMA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exclui em definitivo uma atividade Postergada — exclusivo do Administrador',
  })
  async atividadeExcluir(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Param('atividadeId', ParseIntPipe) atividadeId: number,
  ) {
    const { ok, mensagem } = await this.cronograma.atividadeExcluir(
      atividadeId,
      projetoId,
    );
    if (!ok) throw new UnprocessableEntityException(mensagem);
    return new ApiEnvelope(null, mensagem);
  }

  @Get('acompanhamento')
  @ApiOperation({
    summary:
      'Lista (read-only) as atividades alocadas, com filtro por data/técnico/status',
  })
  async acompanhamento(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @Query() filtro: AcompanhamentoQueryDto,
  ) {
    const todas = (await this.cronograma.listarAtividades(projetoId)).filter(
      (a) => a.data && a.turno,
    );
    const filtradas = todas.filter(
      (a) =>
        (!filtro.data || a.data === filtro.data) &&
        (!filtro.tecnico || (a.tecnico || '').trim() === filtro.tecnico) &&
        (!filtro.status || (a.status || '') === filtro.status),
    );
    filtradas.sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (a.turno === 'manha' ? 0 : 1) - (b.turno === 'manha' ? 0 : 1) ||
        a.modulo.localeCompare(b.modulo) ||
        a.seq - b.seq,
    );
    return new ApiEnvelope({ atividades: filtradas, total: filtradas.length });
  }

  @Post('gerar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gera o cronograma de visitas (.xlsx) a partir das alocações — equivalente a ' +
      'webapp/routes_agenda.py:projeto_agenda_gerar. Chama o serviço interno de geração ' +
      '(docservice/). Pendência: ainda não anexa um Documento/Evento ao projeto (essa ' +
      'infraestrutura ainda não foi convertida — ver docs/migracao/03-documento-conversao.md).',
  })
  async gerar(
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const projeto = await this.cronograma.projetoParaGeracao(projetoId);
    if (!projeto) throw new NotFoundException('Projeto não encontrado.');
    const atividades = await this.cronograma.listarAtividades(projetoId);
    if (!atividades.some((a) => a.data && a.turno)) {
      throw new UnprocessableEntityException(
        'Aloque ao menos uma atividade no calendário antes de gerar o cronograma.',
      );
    }
    const horarios = await this.cronograma.horarios(projetoId);
    const designacoes = await this.designacoes.doProjeto(projetoId);
    const cfg = await this.cronograma.config(projetoId);

    const arquivo = await this.geracao.postParaArquivo(
      '/gerar/cronograma-visitas',
      {
        projeto,
        atividades: atividades.map((a) => ({
          id: a.id,
          modulo: a.modulo,
          seq: a.seq,
          descricao: a.descricao,
          tipo: a.tipo,
          data: a.data,
          turno: a.turno,
          tecnico: a.tecnico,
          status: a.status,
        })),
        horarios,
        designacoes: designacoes.map((d) => ({
          modulo: d.modulo,
          consultor: d.consultor,
          analista: d.analista,
        })),
        cronogramaConfig: { analistaPadrao: cfg.analistaPadrao },
      },
    );

    // Anexa à ficha do projeto (Documento) + registra na timeline (Evento) — mesmo
    // comportamento de webapp/routes_agenda.py:projeto_agenda_gerar. Feito depois de gerar
    // com sucesso, sem bloquear o download caso a persistência falhe por algum motivo.
    const salvo = this.documentos.salvarArquivoGerado(projetoId, arquivo.filename, arquivo.buffer);
    await this.documentos.registrarDocumento(projetoId, 'cronograma', salvo.arquivo, salvo.caminho, 'gerado');
    await this.documentos.registrarEvento(
      projetoId,
      'documento',
      `Gerou cronograma de visitas ${arquivo.filename}`,
      user.nome,
    );

    res.set({
      'Content-Type': arquivo.contentType,
      'Content-Disposition': `attachment; filename="${arquivo.filename}"`,
    });
    res.send(arquivo.buffer);
  }
}
