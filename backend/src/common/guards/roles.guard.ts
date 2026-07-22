import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfil, temPapel } from '../constants/perfis';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

/** Rota sem @Roles() fica liberada para qualquer autenticado; com @Roles(...), passa quem
 * TIVER pelo menos um dos papéis listados (o usuário pode ter vários). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Perfil[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    // Basta ter UM dos papéis exigidos: a mesma pessoa acumula cargos (GCI e Levantador,
    // por exemplo), então comparar com um perfil único trancaria acesso legítimo.
    return temPapel(user, ...required);
  }
}
