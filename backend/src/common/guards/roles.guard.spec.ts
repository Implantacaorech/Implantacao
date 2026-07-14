import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { AuthUser } from '../decorators/current-user.decorator';

function contextComUsuario(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('libera quando a rota não declara @Roles()', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextComUsuario(undefined))).toBe(true);
  });

  it('bloqueia usuário sem sessão quando a rota exige perfil', () => {
    const reflector = {
      getAllAndOverride: () => ['ADM'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextComUsuario(undefined))).toBe(false);
  });

  it('bloqueia perfil fora da lista permitida', () => {
    const reflector = {
      getAllAndOverride: () => ['ADM', 'Coordenador'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user: AuthUser = {
      sub: 1,
      login: 'x',
      nome: 'Consultor',
      perfil: 'Consultor',
      codigoSicla: '',
    };
    expect(guard.canActivate(contextComUsuario(user))).toBe(false);
  });

  it('libera perfil presente na lista permitida', () => {
    const reflector = {
      getAllAndOverride: () => ['ADM', 'Coordenador'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user: AuthUser = {
      sub: 1,
      login: 'x',
      nome: 'Coord',
      perfil: 'Coordenador',
      codigoSicla: '',
    };
    expect(guard.canActivate(contextComUsuario(user))).toBe(true);
  });
});
