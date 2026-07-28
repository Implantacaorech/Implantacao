import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissaoGuard } from './permissao.guard';
import { Permissao } from '../common/decorators/permissao.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { ApiEnvelope } from '../common/dto/api-envelope';
import { MENUS, NIVEIS, PAPEIS_PERMISSAO } from '../common/constants/menus';
import { PermissoesService } from './permissoes.service';
import { UsersService } from '../users/users.service';
import {
  SalvarPermissaoPapelDto,
  SalvarPermissaoUsuarioDto,
} from './dto/salvar-permissao.dto';

/** Painel de Permissões (Gestão): manutenção do RBAC por papel × menu, com exceção por
 * usuário. A leitura do PRÓPRIO mapa (`/me`) é livre a qualquer autenticado — alimenta o
 * menu/guards do Angular; a manutenção é gate `permissoes` (só ADM, por seed). */
@ApiTags('permissoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissaoGuard)
@Controller('permissoes')
export class PermissoesController {
  constructor(
    private readonly permissoes: PermissoesService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Mapa menu→nível do usuário logado (menu/guards do Angular)' })
  me(@CurrentUser() user: AuthUser) {
    return new ApiEnvelope({ niveis: this.permissoes.mapaDoUsuario(user) });
  }

  @Get()
  @Permissao('permissoes')
  @ApiOperation({ summary: 'Matriz completa para a tela de manutenção (ADM)' })
  async matriz() {
    const usuarios = (await this.users.listar()).map((u) => ({
      id: u.id,
      nome: u.nome,
      login: u.login,
      perfil: u.perfil,
    }));
    return new ApiEnvelope({
      ...this.permissoes.matriz(),
      niveis: NIVEIS,
      usuarios,
    });
  }

  @Put('papel')
  @Permissao('permissoes', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define o nível de um PAPEL num menu' })
  async salvarPapel(@Body() dto: SalvarPermissaoPapelDto) {
    await this.permissoes.salvarPapel(dto.papel, dto.menu, dto.nivel);
    return new ApiEnvelope({ salvo: true });
  }

  @Put('usuario')
  @Permissao('permissoes', 'alteracao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Define (ou remove, com "herdar") a exceção de um USUÁRIO num menu',
  })
  async salvarUsuario(@Body() dto: SalvarPermissaoUsuarioDto) {
    await this.permissoes.salvarUsuario(
      dto.usuarioId,
      dto.menu,
      dto.nivel === 'herdar' ? null : dto.nivel,
    );
    return new ApiEnvelope({ salvo: true });
  }

  @Get('catalogo')
  @Permissao('permissoes')
  @ApiOperation({ summary: 'Menus, papéis e níveis disponíveis' })
  catalogo() {
    return new ApiEnvelope({
      menus: MENUS,
      papeis: PAPEIS_PERMISSAO,
      niveis: NIVEIS,
    });
  }
}
