import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { perfilGuard } from './perfil.guard';

describe('perfilGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => localStorage.clear());

  function logarComo(perfil: string, perfis?: string[]): void {
    localStorage.setItem(
      'painel.usuario',
      JSON.stringify({ sub: 1, login: 'x', nome: 'X', perfil, perfis, codigoSicla: '' }),
    );
    TestBed.inject(AuthService);
  }

  it('redireciona para /home quando não há sessão', () => {
    const guard = perfilGuard('ADM');
    const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(resultado).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/home');
  });

  it('redireciona para /home quando o perfil não está na lista permitida', () => {
    logarComo('Consultor');
    const guard = perfilGuard('ADM', 'Coordenador');
    const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(resultado).toBeInstanceOf(UrlTree);
  });

  it('libera quando o perfil está na lista permitida', () => {
    logarComo('ADM');
    const guard = perfilGuard('ADM', 'Coordenador');
    const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(resultado).toBe(true);
  });

  // Correção de 2026-07-28: a pessoa acumula cargos — comparar só com o `perfil` principal
  // trancava fora de rota que o backend (RolesGuard, que usa `perfis`) liberaria.
  it('libera por papel ACUMULADO, não só pelo perfil principal', () => {
    logarComo('Consultor', ['Consultor', 'Coordenador']);
    const guard = perfilGuard('ADM', 'Coordenador');
    const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(resultado).toBe(true);
  });

  it('bloqueia quando nenhum dos papéis acumulados está na lista', () => {
    logarComo('Consultor', ['Consultor', 'Levantador']);
    const guard = perfilGuard('ADM', 'Coordenador');
    const resultado = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(resultado).toBeInstanceOf(UrlTree);
  });
});
