import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Perfil } from '../constants/perfis';

export interface AuthUser {
  sub: number;
  login: string;
  nome: string;
  /** Papel principal — para exibição e compatibilidade. */
  perfil: Perfil;
  /** TODOS os papéis do usuário. É por AQUI que se decide permissão: a mesma pessoa
   * acumula cargos (GCI e Levantador, por exemplo). Use `temPapel()`. */
  perfis: Perfil[];
  codigoSicla: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
