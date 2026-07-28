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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  PERFIS_SISTEMA,
  PERFIS_VEEM_TODOS_PROJETOS,
} from '../common/constants/perfis';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { MatrizTecnico } from '../database/entities/matriz-tecnico.entity';
import { MatrizService } from './matriz.service';
import { SalvarNotasMatrizDto } from './dto/salvar-notas-matriz.dto';

// Quem vê TODAS as linhas da matriz (consulta): PERFIS_VEEM_TODOS_PROJETOS
// (ADM/Coordenador/Administrativo) + Comercial, que ganhou acesso à Matriz em 2026-07-28
// só como consulta (sem editar). ADM é o único que edita tudo; GCI/Levantador/Consultor
// veem/editam apenas a própria linha — não confundir com PERFIS_GESTAO.
const MATRIZ_VE_TODOS: string[] = [
  ...(PERFIS_VEEM_TODOS_PROJETOS as string[]),
  'Comercial',
];
function veTudo(perfil: string): boolean {
  return MATRIZ_VE_TODOS.includes(perfil);
}

function podeEditar(
  user: AuthUser,
  t: MatrizTecnico,
  minha: MatrizTecnico | null,
): boolean {
  if (user.perfil === 'ADM') return true;
  if (veTudo(user.perfil)) return false; // Administrativo/Coordenador: só consulta
  return !!(minha && minha.id === t.id);
}

/** Matriz de Conhecimento (/matriz*). Permissões (definição do usuário em 2026-07-28):
 * ADM vê/edita tudo (+ importar planilha); Coordenador/Administrativo/Comercial veem tudo,
 * só consulta; Consultor/GCI/Levantador veem/editam apenas a própria linha (casada por
 * Código SICLA/nome). Sem o fallback "sem login = acesso total" do Flask — `JwtAuthGuard`
 * já exige login sempre neste backend novo. */
@ApiTags('matriz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matriz')
export class MatrizController {
  constructor(private readonly service: MatrizService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista a Matriz (ADM/Coordenador/Administrativo veem todos; Consultor/GCI só a própria linha)',
  })
  async listar(@CurrentUser() user: AuthUser) {
    if (veTudo(user.perfil)) {
      // `notas()` é síncrono: o `Promise.all` com callback `async` só criava uma Promise
      // por técnico para resolver de imediato, sem nada assíncrono dentro.
      const itens = (await this.service.listar()).map((t) => ({
        ...t,
        qtdNotas: Object.keys(this.service.notas(t)).length,
      }));
      return new ApiEnvelope({
        itens,
        restrito: false,
        podeAdmin: user.perfil === 'ADM',
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
    const minha = veTudo(user.perfil)
      ? null
      : await this.service.linhaDoUsuario(user.nome, user.codigoSicla);
    if (!veTudo(user.perfil) && !(minha && minha.id === t.id)) {
      throw new ForbiddenException('Sem acesso à ficha de outro técnico.');
    }
    return new ApiEnvelope({
      tecnico: t,
      areas: await this.service.areasComCompetencias(),
      notas: this.service.notas(t),
      editavel: podeEditar(user, t, minha),
      volta: veTudo(user.perfil),
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
    const minha = veTudo(user.perfil)
      ? null
      : await this.service.linhaDoUsuario(user.nome, user.codigoSicla);
    if (!podeEditar(user, t, minha)) {
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
