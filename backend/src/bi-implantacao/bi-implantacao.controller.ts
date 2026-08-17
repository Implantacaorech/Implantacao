import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { BiImplantacaoService } from './bi-implantacao.service';
import {
  QueryAgendasDto,
  QueryDescricaoDto,
  QueryExtratoDto,
  QueryResumoDto,
  QueryRnsDto,
  QueryVisitasPortalDto,
} from './dto/query-resumo.dto';

/** BI de Implantação — porte das páginas do `BI_clientes.pbix` (Power BI) para dentro do
 * Painel. Gate pelo menu `bi_implantacao` do painel de Permissões. */
@ApiTags('bi-implantacao')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('bi_implantacao')
@Controller('bi-implantacao')
export class BiImplantacaoController {
  constructor(private readonly bi: BiImplantacaoService) {}

  @Get('resumo')
  @ApiOperation({
    summary:
      'Resumo de Implantação: RNS do período com horas previstas/realizadas/saldo, totais e agrupamentos',
  })
  async resumo(@Query() query: QueryResumoDto) {
    return new ApiEnvelope(await this.bi.resumo(query));
  }

  @Get('visitas-portal')
  @ApiOperation({
    summary:
      'Visitas do usuário no Portal Rech com a aprovação real (statusAprovacao) — lidas da API do Portal com a credencial dele',
  })
  async visitasPortal(
    @Query() query: QueryVisitasPortalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiEnvelope(await this.bi.visitasPortal(query, user.sub));
  }

  @Get('extrato')
  @ApiOperation({
    summary:
      'Extrato de Protocolo/Horas: lançamentos do período com horas utilizadas e saldo acumulado',
  })
  async extrato(@Query() query: QueryExtratoDto) {
    return new ApiEnvelope(await this.bi.extrato(query));
  }

  @Get('rns')
  @ApiOperation({
    summary:
      'RNS vinculadas às implantações do período (conversões, desenvolvimentos, erros…)',
  })
  async rns(@Query() query: QueryRnsDto) {
    return new ApiEnvelope(await this.bi.rnsVinculadas(query));
  }

  @Get('agendas')
  @ApiOperation({
    summary: 'Agendas do mês em formato de calendário, com resumo por status',
  })
  async agendas(@Query() query: QueryAgendasDto) {
    return new ApiEnvelope(await this.bi.agendas(query));
  }

  @Get('extrato/descricao')
  @ApiOperation({
    summary:
      'Texto completo da descrição de um lançamento (a listagem traz só uma prévia)',
  })
  async descricao(@Query() query: QueryDescricaoDto) {
    const protocolo = Number(query.protocolo);
    const datahora = (query.datahora ?? '').trim();
    if (!Number.isFinite(protocolo) || !datahora) {
      return new ApiEnvelope({
        descricao: '',
        tamanho: 0,
        erro: 'Informe protocolo e datahora (AAAA-MM-DD HH:MM).',
      });
    }
    return new ApiEnvelope(
      await this.bi.descricaoCompleta(protocolo, datahora),
    );
  }
}
