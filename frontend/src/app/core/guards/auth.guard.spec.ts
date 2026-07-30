import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { PreferenciasService } from '../services/preferencias.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => localStorage.clear());

  // O guard virou assíncrono: além de barrar quem não tem sessão, ele PRÉ-CARREGA as
  // preferências (filtros salvos) do usuário, para cada tela restaurá-las de forma síncrona.
  it('redireciona para /login quando não há sessão', async () => {
    const resultado = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(resultado).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado as UrlTree)).toBe('/login');
  });

  it('não pede as preferências quando não há sessão', async () => {
    const http = TestBed.inject(HttpTestingController);
    await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    http.expectNone(`${environment.apiUrl}/preferencias`);
  });

  it('libera quando o usuário está autenticado', async () => {
    localStorage.setItem(
      'painel.usuario',
      JSON.stringify({ sub: 1, login: 'admin', nome: 'Administrador', perfil: 'ADM', codigoSicla: '' }),
    );
    // AuthService lê o usuário salvo no construtor — precisa injetar de novo depois de popular o storage.
    TestBed.inject(AuthService);
    const resultado = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(resultado).toBe(true);
  });

  it('com sessão, carrega as preferências antes de liberar a navegação', async () => {
    localStorage.setItem('painel.accessToken', 'tok');
    localStorage.setItem(
      'painel.usuario',
      JSON.stringify({ sub: 1, login: 'admin', nome: 'Administrador', perfil: 'ADM', codigoSicla: '' }),
    );
    TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const preferencias = TestBed.inject(PreferenciasService);

    const promessa = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    http.expectOne(`${environment.apiUrl}/preferencias`).flush({
      success: true,
      message: 'ok',
      timestamp: '',
      data: { preferencias: { capacidade: { setor: 'GRM-Implantação' } } },
    });

    expect(await promessa).toBe(true);
    // Já em memória: é o que permite a restauração SÍNCRONA no construtor de cada tela.
    expect(preferencias.carregadas).toBe(true);
    expect(preferencias.ler('capacidade')).toEqual({ setor: 'GRM-Implantação' });
  });
});
