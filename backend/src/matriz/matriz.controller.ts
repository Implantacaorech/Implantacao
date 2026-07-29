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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissaoGuard } from '../permissoes/permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { PermissoesService } from '../permissoes/permissoes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  PERFIS_SISTEMA,
  PERFIS_VEEM_TODOS_PROJETOS,
  temPapel,
} from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizService } from './matriz.service';
import { SalvarNotasMatrizDto } from './dto/salvar-notas-matriz.dto';

// Quem vê TODAS as linhas da matriz (consulta): PERFIS_VEEM_TODOS_PROJETOS
// (ADM/Coordenador/Administrativo). O Comercial não entra nesta tela (gate de classe).
// Avalia TODOS os papéis do usuário, não só o principal (correção de 2026-07-28).
function veTudo(user: AuthUser): boolean {
  return temPapel(user, ...PERFIS_VEEM_TODOS_PROJETOS);
}

function podeEditar(
  user: AuthUser,
  t: MatrizTecnico,
  minha: MatrizTecnico | null,
): boolean {
  if (temPapel(user, 'ADM')) return true;
  // Qualquer outro perfil — inclusive Coordenador/Administrativo, que veem todas as linhas —
  // edita SOMENTE a própria (definição do usuário em 2026-07-28: "vê de todos, mas a própria
  // pode alterar"). A linha é casada por Código SICLA/nome.
  return !!(minha && minha.id === t.id);
}

/** Matriz de Conhecimento (/matriz*). Permissões (definição do usuário em 2026-07-28):
 * ADM vê/edita tudo (+ importar planilha); Coordenador/Administrativo veem tudo (consulta)
 * e ainda editam a PRÓPRIA linha; Consultor/GCI/Levantador veem/editam apenas a própria
 * (casada por Código SICLA/nome). O Comercial não acessa esta tela. Sem o fallback "sem
 * login = acesso total" do Flask — `JwtAuthGuard` já exige login sempre. */
@ApiTags('matriz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Permissao('matriz')
@Controller('matriz')
export class MatrizController {
  constructor(
    private readonly service: MatrizService,
    private readonly permissoes: PermissoesService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista a Matriz (ADM/Coordenador/Administrativo veem todos; Consultor/GCI só a própria linha)',
  })
  async listar(@CurrentUser() user: AuthUser) {
    if (veTudo(user)) {
      // `notas()` é síncrono: o `Promise.all` com callback `async` só criava uma Promise
      // por técnico para resolver de imediato, sem nada assíncrono dentro.
      const itens = (await this.service.listar()).map((t) => ({
        ...t,
        qtdNotas: Object.keys(this.service.notas(t)).length,
      }));
      return new ApiEnvelope({
        itens,
        restrito: false,
        podeAdmin: temPapel(user, 'ADM'),
      });
    }
    const minha = await this.service.linhaDoUsuario(
      user.nome,
      user.codigoSicla,
    );
    if (minha) {
      return new ApiEnvelope({
        itens: [],
        restrito: false,
        redirecionarParaId: minha.id,
      });
    }
    return new ApiEnvelope({ itens: [], restrito: true, podeAdmin: false });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de um técnico, notas agrupadas por área' })
  async ficha(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const t = await this.service.buscar(id);
    if (!t) throw new NotFoundException('Técnico não encontrado.');
    // Calcula a própria linha SEMPRE — até quem vê tudo precisa dela para saber se pode
    // editar a sua (não só consultar).
    const minha = await this.service.linhaDoUsuario(user.nome, user.codigoSicla);
    if (!veTudo(user) && !(minha && minha.id === t.id)) {
      throw new ForbiddenException('Sem acesso à ficha de outro técnico.');
    }
    return new ApiEnvelope({
      tecnico: t,
      areas: await this.service.areasComCompetencias(),
      notas: this.service.notas(t),
      // Editável = regra de linha (podeEditar) E o painel liberar Alteração na Matriz.
      editavel:
        podeEditar(user, t, minha) &&
        this.permissoes.podeAlterar(user, 'matriz'),
      volta: veTudo(user),
    });
  }

  @Post(':id/salvar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Salva as notas (0-10) da ficha de um técnico' })
  async salvar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SalvarNotasMatrizDto,
    @CurrentUser() user: AuthUser,
  ) {
    const t = await this.service.buscar(id);
    if (!t) throw new NotFoundException('Técnico não encontrado.');
    const minha = await this.service.linhaDoUsuario(user.nome, user.codigoSicla);
    if (
      !podeEditar(user, t, minha) ||
      !this.permissoes.podeAlterar(user, 'matriz')
    ) {
      throw new ForbiddenException('Sem permissão para alterar esta ficha.');
    }
    await this.service.salvarNotas(id, dto, user.nome);
    return new ApiEnvelope({ salvo: true });
  }

  @Post('importar')
  @Roles(...PERFIS_SISTEMA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reimporta docs/Matriz de Conhecimento.xlsx (aditivo, ADM)',
  })
  async importar(@CurrentUser() user: AuthUser) {
    try {
      const r = await this.service.importar(user.nome || 'importação');
      return new ApiEnvelope({
        ok: true,
        mensagem: `Importado: ${r.novasCompetencias} competências e ${r.novosTecnicos} técnicos novos (${r.ignorados} já existiam, preservados).`,
        ...r,
      });
    } catch (e) {
      // Espelha webapp/routes_matriz.py:matriz_importar — nunca propaga erro HTTP, sempre
      // devolve uma mensagem amigável (a planilha de origem é local/não versionada, então
      // "arquivo não encontrado" é uma falha esperada em vários ambientes).
      const msg = e instanceof Error ? e.message : String(e);
      return new ApiEnvelope({
        ok: false,
        mensagem: `Falha na importação: ${msg}`,
      });
    }
  }
}
