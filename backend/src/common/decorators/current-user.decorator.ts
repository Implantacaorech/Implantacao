import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Perfil } from '../constants/perfis';

export interface AuthUser {
  sub: number;
  login: string;
  nome: string;
  perfil: Perfil;
  codigoSicla: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
