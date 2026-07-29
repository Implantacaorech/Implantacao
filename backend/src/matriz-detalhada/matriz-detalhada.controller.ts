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
import { MatrizDetalhadaService } from './matriz-detalhada.service';
import { SalvarNotasMenuDto } from './dto/salvar-notas-menu.dto';

// Mesma regra de linha da Matriz clássica (definição do usuário 2026-07-28):
// ADM/Coordenador/Administrativo veem todos; ADM edita tudo, os demais só a própria linha.
// Avalia TODOS os papéis do usuário, não só o principal (correção de 2026-07-28).
function veTudo(user: AuthUser): boolean {
  return temPapel(user, ...PERFIS_VEEM_TODOS_PROJETOS);
}

/** Matriz de Conhecimento — DETALHADA (por menu do SIGER). Acesso próprio, ao lado da
 * clássica. As notas são por menu (código de acesso); a nota do módulo é a média deles.
 * Taxonomia vem do Dicionário. Permissões: menu `matriz_detalhada` (acesso) + regra de linha
 * + nível Alteração do painel de Permissões para poder editar. */
@ApiTags('matriz-detalhada')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Permissao('matriz_detalhada')
@Controller('matriz-detalhada')
export class MatrizDetalhadaController {
  constructor(
    private readonly service: MatrizDetalhadaService,
    private readonly matriz: MatrizService,
    private readonly permissoes: PermissoesService,
  ) {}

  private podeEditarLinha(
    user: AuthUser,
    t: MatrizTecnico,
    minha: MatrizTecnico | null,
  ): boolean {
    if (!this.permissoes.podeAlterar(user, 'matriz_detalhada')) return false;
    if (temPapel(user, 'ADM')) return true;
    return !!(minha && minha.id === t.id);
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
    // Só a própria linha.
    return new ApiEnvelope({
      tecnicos: minha ? [{ id: minha.id, nome: minha.nome, setor: minha.setor }] : [],
      meuId: minha?.id ?? null,
      podeVerTodos: false,
      podeAdmin: false,
    });
  }

  @Get('medias-gerais')
  @ApiOperation({
    summary: 'Média GERAL (todos os técnicos) por módulo/adicional — alimenta o gráfico',
  })
  async mediasGerais() {
    return new ApiEnvelope({ modulos: await this.service.mediasGerais() });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha detalhada: módulos/menus + notas + médias' })
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
    const ficha = await this.service.ficha(t);
    return new ApiEnvelope({
      tecnico: { id: t.id, nome: t.nome, setor: t.setor, dias: t.dias },
      ...ficha,
      editavel: this.podeEditarLinha(user, t, minha),
      volta: veTudo(user),
    });
  }

  @Post(':id/salvar')
  @Permissao('matriz_detalhada', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva as notas por menu (0-10) da ficha' })
  async salvar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarNotasMenuDto,
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
