import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PERFIS_GERA_CRONOGRAMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import { CronogramaItensService } from './cronograma-itens.service';
import { ChecklistItensService } from './checklist-itens.service';
import { ModificacoesService } from './modificacoes.service';
import { SalvarCronogramaDto } from './dto/salvar-cronograma.dto';
import { SalvarChecklistDto } from './dto/salvar-checklist.dto';

/** Linhas editáveis do Cronograma/Check List (`/projetos/:id/cronograma`,
 * `/projetos/:id/checklist`) — NÃO confundir com o Agendador de Visitas
 * (`/projetos/:id/agenda*`, item 1). Espelha webapp/routes_cronograma.py.
 *
 * **Gate aplicado a TODAS as rotas, diferente do Flask original**: lá, só
 * `/cronograma/gerar` (geração do documento — ainda não portada, ver
 * docs/migracao/03-documento-conversao.md) tinha `pode_gerar("cronograma")`; as rotas de
 * edição/seed não tinham NENHUM controle de acesso além do login. Decisão deliberada
 * desta conversão: aplicar `PERFIS_GERA_CRONOGRAMA` (mesmo grupo do Flask) também às
 * edições — deixar um endpoint de escrita sem gate de perfil não é um comportamento a
 * preservar por fidelidade, é uma falha de controle de acesso a corrigir. */
@ApiTags('plano-cronograma')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_GERA_CRONOGRAMA)
@Controller('projetos/:id')
export class PlanoCronogramaController {
  constructor(
    @InjectRepository(Projeto) private readonly projetos: Repository<Projeto>,
    @InjectRepository(Evento) private readonly eventos: Repository<Evento>,
    private readonly cronogramaItens: CronogramaItensService,
    private readonly checklistItens: ChecklistItensService,
    private readonly modificacoes: ModificacoesService,
  ) {}

  private async buscarProjeto(id: number): Promise<Projeto> {
    const p = await this.projetos.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Projeto não encontrado.');
    return p;
  }

  private async registrarEvento(projetoId: number, descricao: string, autor: string): Promise<void> {
    await this.eventos.save(this.eventos.create({ projetoId, tipo: 'nota', descricao, autor }));
  }

  // --- Cronograma ---

  @Get('cronograma')
  @ApiOperation({ summary: 'Linhas do Cronograma + histórico de edições' })
  async obterCronograma(@Param('id', ParseIntPipe) id: number) {
    await this.buscarProjeto(id);
    const [itens, historico] = await Promise.all([
      this.cronogramaItens.doProjeto(id),
      this.modificacoes.doProjeto(id, 'cronograma'),
    ]);
    return new ApiEnvelope({ itens, historico });
  }

  @Post('cronograma')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Substitui as linhas do Cronograma (apaga tudo e reinsere, com histórico)' })
  async salvarCronograma(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarCronogramaDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.buscarProjeto(id);
    const mudancas = await this.cronogramaItens.salvar(id, dto.linhas, user.nome);
    await this.registrarEvento(id, `Cronograma editado (${mudancas} alteração(ões)).`, user.nome);
    return new ApiEnvelope({ itens: await this.cronogramaItens.doProjeto(id), mudancas });
  }

  @Post('cronograma/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Substitui as linhas do Cronograma pelo plano automático (destrutivo)' })
  async seedCronograma(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const projeto = await this.buscarProjeto(id);
    const linhas = this.cronogramaItens.gerarPlanoAutomatico(projeto);
    const mudancas = await this.cronogramaItens.salvar(id, linhas, user.nome);
    await this.registrarEvento(id, `Cronograma carregado do plano automático (${linhas.length} agendas).`, user.nome);
    return new ApiEnvelope({ itens: await this.cronogramaItens.doProjeto(id), mudancas });
  }

  // --- Check List ---

  @Get('checklist')
  @ApiOperation({ summary: 'Linhas do Check List + histórico de edições' })
  async obterChecklist(@Param('id', ParseIntPipe) id: number) {
    await this.buscarProjeto(id);
    const [itens, historico] = await Promise.all([
      this.checklistItens.doProjeto(id),
      this.modificacoes.doProjeto(id, 'checklist'),
    ]);
    return new ApiEnvelope({ itens, historico });
  }

  @Post('checklist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Substitui as linhas do Check List (apaga tudo e reinsere, com histórico)' })
  async salvarChecklist(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarChecklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.buscarProjeto(id);
    const mudancas = await this.checklistItens.salvar(id, dto.linhas, user.nome);
    await this.registrarEvento(id, `Check-list editado (${mudancas} alteração(ões)).`, user.nome);
    return new ApiEnvelope({ itens: await this.checklistItens.doProjeto(id), mudancas });
  }

  @Post('checklist/seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Substitui as linhas do Check List pelo roteiro dos módulos (destrutivo)' })
  async seedChecklist(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const projeto = await this.buscarProjeto(id);
    const linhas = await this.checklistItens.gerarRoteiroDoCatalogo(projeto);
    const mudancas = await this.checklistItens.salvar(id, linhas, user.nome);
    await this.registrarEvento(id, `Check-list carregado do roteiro dos módulos (${linhas.length} itens).`, user.nome);
    return new ApiEnvelope({ itens: await this.checklistItens.doProjeto(id), mudancas });
  }
}
