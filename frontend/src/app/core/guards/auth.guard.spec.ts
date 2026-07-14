import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => localStorage.clear());

  it('redireciona para /login quando não há sessão', () => {
    const resultado = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(resultado).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('libera quando o usuário está autenticado', () => {
    localStorage.setItem(
      'painel.usuario',
      JSON.stringify({ sub: 1, login: 'admin', nome: 'Administrador', perfil: 'ADM', codigoSicla: '' }),
    );
    // AuthService lê o usuário salvo no construtor — precisa injetar de novo depois de popular o storage.
    TestBed.inject(AuthService);
    const resultado = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(resultado).toBe(true);
  });
});
