import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('começa deslogado quando não há sessão salva', () => {
    expect(service.autenticado()).toBe(false);
    expect(service.usuario()).toBeNull();
  });

  it('login guarda tokens e usuário, e autentica', async () => {
    const promessa = service.login('admin', 'senha123');

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: 'admin', senha: 'senha123' });
    req.flush({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        usuario: { sub: 1, login: 'admin', nome: 'Administrador', perfil: 'ADM', codigoSicla: '' },
      },
    });

    await promessa;
    expect(service.autenticado()).toBe(true);
    expect(service.usuario()?.login).toBe('admin');
    expect(service.accessToken).toBe('access-1');
  });

  it('logout limpa a sessão mesmo se a chamada ao backend falhar', async () => {
    const loginPromessa = service.login('admin', 'senha123');
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        usuario: { sub: 1, login: 'admin', nome: 'Administrador', perfil: 'ADM', codigoSicla: '' },
      },
    });
    await loginPromessa;
    expect(service.autenticado()).toBe(true);

    const logoutPromessa = service.logout().catch(() => undefined);
    httpMock.expectOne(`${environment.apiUrl}/auth/logout`).flush({}, { status: 500, statusText: 'Erro' });

    await logoutPromessa;
    expect(service.autenticado()).toBe(false);
    expect(localStorage.getItem('painel.accessToken')).toBeNull();
  });
});
