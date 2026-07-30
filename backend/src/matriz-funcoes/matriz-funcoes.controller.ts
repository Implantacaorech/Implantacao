import {
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
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { PermissoesService } from '../permissoes/permissoes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  PERFIS_VEEM_TODOS_PROJETOS,
  temPapel,
} from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizService } from '../matriz/matriz.service';
import { MatrizFuncoesService } from './matriz-funcoes.service';
import { FuncoesSiclaService } from './funcoes-sicla.service';
import { SalvarNotasFuncaoDto } from './dto/salvar-notas-funcao.dto';

// Mesma regra de linha da Matriz clássica e da Matriz por Menu: ADM/Coordenador/
// Administrativo veem todos; ADM edita tudo, os demais só a própria linha.
function veTudo(user: AuthUser): boolean {
  return temPapel(user, ...PERFIS_VEEM_TODOS_PROJETOS);
}

/** Matriz por Menu — FUNÇÕES SICLA. Mesma estrutura e formato da Matriz por Menu do
 * Dicionário, mas a taxonomia vem de `SICLA.LISTA_FUNCOES` agrupada por STRMENUS, e as
 * notas ficam em `notas_funcao`. Permissões: menu `matriz_funcoes` + regra de linha +
 * nível Alteração. */
@ApiTags('matriz-funcoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('matriz_funcoes')
@Controller('matriz-funcoes')
export class MatrizFuncoesController {
  constructor(
    private readonly service: MatrizFuncoesService,
    private readonly funcoes: FuncoesSiclaService,
    private readonly matriz: MatrizService,
    private readonly permissoes: PermissoesService,
  ) {}

  private podeEditarLinha(
    user: AuthUser,
    t: MatrizTecnico,
    minha: MatrizTecnico | null,
  ): boolean {
    if (!this.permissoes.podeAlterar(user, 'matriz_funcoes')) return false;
    if (temPapel(user, 'ADM')) return true;
    return !!(minha && minha.id === t.id);
  }

  /** A taxonomia depende do Oracle do SICLA. Quando ele está fora, devolve 503 com a
   * mensagem do banco em vez de um 500 opaco — a tela mostra o motivo. */
  private indisponivel(e: unknown): never {
    throw new ServiceUnavailableException(
      `Não foi possível ler as funções no SICLA: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      'Técnicos visíveis + qual é o meu (ADM/Coord/Adm veem todos; demais só a própria linha)',
  })
  async listar(@CurrentUser() user: AuthUser) {
    const minha = await this.matriz.linhaDoUsuario(user.nome, user.codigoSicla);
    if (veTudo(user)) {
      const itens = (await this.matriz.listar()).map((t) => ({
        id: t.id,
        nome: t.nome,
        setor: t.setor,
      }));
      return new ApiEnvelope({
        tecnicos: itens,
        meuId: minha?.id ?? null,
        podeVerTodos: true,
        podeAdmin: temPapel(user, 'ADM'),
      });
    }
    return new ApiEnvelope({
      tecnicos: minha
        ? [{ id: minha.id, nome: minha.nome, setor: minha.setor }]
        : [],
      meuId: minha?.id ?? null,
      podeVerTodos: false,
      podeAdmin: false,
    });
  }

  @Get('medias-gerais')
  @ApiOperation({
    summary: 'Média GERAL (todos os técnicos) por módulo — alimenta o gráfico',
  })
  async mediasGerais() {
    try {
      return new ApiEnvelope({ modulos: await this.service.mediasGerais() });
    } catch (e) {
      this.indisponivel(e);
    }
  }

  @Post('recarregar')
  @Permissao('matriz_funcoes', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Descarta o cache e relê as funções do SICLA (use depois de mexer na LISTA_FUNCOES)',
  })
  async recarregar() {
    this.funcoes.limparCache();
    try {
      const tax = await this.funcoes.taxonomia(true);
      return new ApiEnvelope({
        modulos: tax.length,
        funcoes: tax.reduce((a, m) => a + m.funcoes.length, 0),
      });
    } catch (e) {
      this.indisponivel(e);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha: módulos/funções + notas + médias' })
  async ficha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const t = await this.matriz.buscar(id);
    if (!t) throw new NotFoundException('Técnico não encontrado.');
    const minha = await this.matriz.linhaDoUsuario(user.nome, user.codigoSicla);
    if (!veTudo(user) && !(minha && minha.id === t.id)) {
      throw new ForbiddenException('Sem acesso à ficha de outro técnico.');
    }
    try {
      const ficha = await this.service.ficha(t);
      return new ApiEnvelope({
        tecnico: { id: t.id, nome: t.nome, setor: t.setor, dias: t.dias },
        ...ficha,
        editavel: this.podeEditarLinha(user, t, minha),
        volta: veTudo(user),
      });
    } catch (e) {
      this.indisponivel(e);
    }
  }

  @Post(':id/salvar')
  @Permissao('matriz_funcoes', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva as notas por função (0-10) da ficha' })
  async salvar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarNotasFuncaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    const t = await this.matriz.buscar(id);
    if (!t) throw new NotFoundException('Técnico não encontrado.');
    const minha = await this.matriz.linhaDoUsuario(user.nome, user.codigoSicla);
    if (!this.podeEditarLinha(user, t, minha)) {
      throw new ForbiddenException('Sem permissão para alterar esta ficha.');
    }
    await this.service.salvar(id, dto.notas, user.nome);
    return new ApiEnvelope({ salvo: true });
  }
}
