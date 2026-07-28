import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSAO_KEY,
  PermissaoMeta,
} from '../common/decorators/permissao.decorator';
import { atendeNivel } from '../common/constants/menus';
import { PermissoesService, UsuarioPermissao } from './permissoes.service';

/** Aplica o gate por MENU declarado com @Permissao, resolvendo o nível efetivo do usuário
 * contra o painel de Permissões (banco). Rota sem @Permissao passa direto — assim o guard
 * pode conviver com JwtAuthGuard/RolesGuard sem afetar rotas não migradas. */
@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissoes: PermissoesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<PermissaoMeta>(PERMISSAO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    const user: UsuarioPermissao | undefined = req.user;
    if (!user) throw new UnauthorizedException();

    const nivel = this.permissoes.nivelEfetivo(user, meta.menu);
    if (!atendeNivel(nivel, meta.nivel)) {
      throw new ForbiddenException('Sem permissão para acessar esta tela.');
    }
    return true;
  }
}
