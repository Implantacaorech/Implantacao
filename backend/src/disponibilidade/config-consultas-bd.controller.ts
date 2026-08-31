import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PERFIS_SISTEMA } from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { ConsultaBdService } from '../dados/consulta-bd.service';
import { DadosService } from '../dados/dados.service';
import { SalvarConsultaBdDto } from './dto/salvar-consulta-bd.dto';

/** Consultas BD (SQLs nomeadas contra a conexão externa) — exclusivo do Administrador,
 * mais restrito que as demais telas de "Sistema" (mesmo guard `PERFIS_SISTEMA=['ADM']`
 * aqui, mas sem o fallback "sem login = acesso total" que `pode_ver` tinha no Flask —
 * `JwtAuthGuard` já exige login sempre neste backend novo). Espelha
 * webapp/routes_config.py:config_consultas_bd. */
@ApiTags('config-consultas-bd')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PERFIS_SISTEMA)
@Controller('config/consultas-bd')
export class ConfigConsultasBdController {
  constructor(
    private readonly consultas: ConsultaBdService,
    private readonly dados: DadosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista as consultas salvas' })
  async listar() {
    return new ApiEnvelope({ itens: await this.consultas.listar() });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Detalhe de uma consulta salva' })
  async obter(@Param('slug') slug: string) {
    const c = await this.consultas.porSlug(slug);
    if (!c) throw new NotFoundException('Consulta não encontrada.');
    return new ApiEnvelope(c);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cria uma nova consulta (slug derivado do nome, se não informado)',
  })
  async criar(@Body() dto: SalvarConsultaBdDto & { slug?: string }) {
    const slugBase = (dto.slug || dto.nome || '').trim();
    if (!slugBase) {
      throw new BadRequestException(
        'Informe um nome (ou slug) para a nova consulta.',
      );
    }
    const existente = await this.consultas.porSlug(slugBase);
    if (existente) {
      throw new BadRequestException(
        'Já existe uma consulta com esse identificador.',
      );
    }
    return new ApiEnvelope(await this.consultas.salvar(slugBase, dto));
  }

  @Post(':slug')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualiza uma consulta salva' })
  async atualizar(
    @Param('slug') slug: string,
    @Body() dto: SalvarConsultaBdDto,
  ) {
    const r = await this.consultas.salvar(slug, dto);
    if (!r) throw new NotFoundException('Consulta não encontrada.');
    return new ApiEnvelope(r);
  }

  @Post(':slug/excluir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exclui uma consulta salva' })
  async excluir(@Param('slug') slug: string) {
    const ok = await this.consultas.excluir(slug);
    if (!ok) throw new NotFoundException('Consulta não encontrada.');
    return new ApiEnvelope({ excluido: true });
  }

  @Post(':slug/testar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Roda a consulta numa janela genérica de 1 ano à frente (:data_ini/:data_fim sempre supridos)',
  })
  async testar(@Param('slug') slug: string) {
    const consulta = await this.consultas.porSlug(slug);
    if (!consulta) throw new NotFoundException('Consulta não encontrada.');
    const hoje = new Date();
    const daquiUmAno = new Date(hoje);
    daquiUmAno.setDate(daquiUmAno.getDate() + 365);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const binds = { data_ini: iso(hoje), data_fim: iso(daquiUmAno) };
    // Cada consulta roda na SUA conexão (campo `conexao`): 'portal' = banco do Portal
    // Rech (MySQL, ignora binds não referenciados); default = Oracle da Disponibilidade,
    // que EXIGE os dois binds no texto (contrato de sempre desta tela).
    const r = await this.dados.executarSqlDeAdministrador(
      consulta.conexao === 'portal' ? 'portal_rech' : 'sicla',
      consulta.sql,
      binds,
    );
    return new ApiEnvelope(r);
  }
}
