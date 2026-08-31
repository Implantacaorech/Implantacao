import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissoesService } from '../services/permissoes.service';
import { ROTA_INICIAL_CLIENTE, rotaInicialGuard } from './rota-inicial.guard';

describe('rotaInicialGuard', () => {
  let podeVerBi = true;

  beforeEach(() => {
    localStorage.clear();
    podeVerBi = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: PermissoesService,
          useValue: {
            garantirCarregado: () => Promise.resolve(),
            podeVer: () => podeVerBi,
          },
        },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  function logarComo(perfil: string): void {
    localStorage.setItem(
      'painel.usuario',
      JSON.stringify({ sub: 1, login: 'x', nome: 'X', perfil, codigoSicla: '' }),
    );
    TestBed.inject(AuthService);
  }

  const rodar = () =>
    TestBed.runInInjectionContext(() =>
      rotaInicialGuard({} as never, {} as never),
    );

  it('deixa o papel interno na Visão Geral', async () => {
    logarComo('Consultor');
    await expect(rodar()).resolves.toBe(true);
  });

  it('manda o cliente para o BI dele', async () => {
    logarComo('Cliente');
    const resultado = await rodar();
    expect(resultado).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(resultado as UrlTree)).toBe(
      ROTA_INICIAL_CLIENTE,
    );
  });

  // Sem esta guarda o par de redirecionamentos (`/home` → BI → `/home`) vira laço infinito
  // e trava o navegador — basta um administrador tirar o BI do papel Cliente.
  it('NÃO redireciona o cliente sem permissão no BI (evita o laço)', async () => {
    logarComo('Cliente');
    podeVerBi = false;
    await expect(rodar()).resolves.toBe(true);
  });

  it('sem sessão não desvia — quem trata isso é o authGuard', async () => {
    await expect(rodar()).resolves.toBe(true);
  });
});
