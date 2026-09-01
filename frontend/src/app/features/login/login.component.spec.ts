import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth-user.model';
import { CHAVE_LOGIN_LEMBRADO } from '../../core/constants/sessao';
import {
  InstanciaService,
  PerfilInstancia,
} from '../../core/services/instancia.service';

function usuario(perfis: string[]): AuthUser {
  return {
    sub: 1,
    login: 'ana@rech.com.br',
    nome: 'Ana',
    perfil: perfis[0],
    perfis,
    codigoSicla: '007',
  } as AuthUser;
}

describe('LoginComponent', () => {
  function instancia(perfil: PerfilInstancia): InstanciaService {
    const i = new InstanciaService();
    i.definir({
      perfil,
      nome: perfil === 'portal-api' ? 'Portal API' : 'Painel de Implantação',
      descricao: '',
      rotaInicial: perfil === 'portal-api' ? '/config/api-dados' : '/home',
    });
    return i;
  }

  function montar(
    authService: Partial<AuthService> = {},
    perfil: PerfilInstancia = 'painel',
  ) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            login: vi.fn(),
            usuario: signal<AuthUser | null>(usuario(['Consultor'])),
            ...authService,
          },
        },
        { provide: InstanciaService, useFactory: () => instancia(perfil) },
      ],
    });
    return TestBed.createComponent(LoginComponent);
  }

  beforeEach(() => {
    localStorage.removeItem(CHAVE_LOGIN_LEMBRADO);
    TestBed.resetTestingModule();
  });

  it('no Portal API o cartão de acesso se identifica como Portal API', () => {
    // São portais diferentes, com finalidades diferentes: quem chega precisa saber em qual
    // está ANTES de digitar a senha.
    const fixture = montar({}, 'portal-api');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.acesso-sub').textContent.trim()).toBe(
      'Portal API',
    );
  });

  // O cartão de login ficou só com o logo (pedido do usuário em 2026-09-01): a tela é a
  // porta de entrada também do CLIENTE, e "Implantação SIGER®" é vocabulário interno da
  // Rech — não diz nada ao contato de um cliente.
  it('traz o logo Portal Rech, e NADA de subtítulo no Painel', () => {
    const fixture = montar();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('img.acesso-logo')?.getAttribute('src')).toBe(
      'logo-portal-rech-azul.png',
    );
    expect(el.querySelector('.acesso-sub')).toBeNull();
    expect(el.textContent).not.toContain('Implantação SIGER');
  });

  it('não oferece mais "Criar conta" e mostra "Esqueci minha senha"', () => {
    const fixture = montar();
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Criar conta');
    expect(texto).toContain('Esqueci minha senha');
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.acesso-linha a');
    expect(link.getAttribute('href')).toBe('/esqueci-senha');
  });

  // O link saiu do login (2026-09-01). A ROTA continua existindo: quem tem o endereço
  // alcança a apresentação; o que deixou de haver é o convite a quem só quer entrar.
  it('não oferece mais a apresentação na tela de login', () => {
    const fixture = montar();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.login-apresentacao'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Conheça os recursos',
    );
  });

  it('"Lembrar-me" guarda só o e-mail, e só depois do login dar certo', async () => {
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    comp.form.setValue({ login: 'ana@rech.com.br', senha: 'segredo123', lembrar: true });
    await comp.enviar();

    expect(localStorage.getItem(CHAVE_LOGIN_LEMBRADO)).toBe('ana@rech.com.br');
  });

  it('login que falha não guarda o e-mail nem navega', async () => {
    const fixture = montar({ login: vi.fn().mockRejectedValue(new Error('401')) });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    comp.form.setValue({ login: 'ana@rech.com.br', senha: 'errada', lembrar: true });
    await comp.enviar();

    expect(localStorage.getItem(CHAVE_LOGIN_LEMBRADO)).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
    expect(comp.erro()).toContain('Não foi possível entrar');
  });

  it('falha ao ABRIR o Painel não é relatada como senha errada', async () => {
    // Regressão do incidente de 2026-08-03: a senha era aceita e o token emitido, mas o
    // chunk da rota /home tinha sumido no rebuild. Como o navigateByUrl estava dentro do
    // mesmo try do login, a tela dizia "Verifique login e senha" — e a equipe reportou
    // "os logins não funcionam".
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockRejectedValue(
      new Error('Http failure: /home indisponível'),
    );

    comp.form.setValue({ login: 'ana@rech.com.br', senha: 'segredo123', lembrar: false });
    await comp.enviar();

    expect(comp.erro()).toContain('Sua senha foi aceita');
    expect(comp.erro()).not.toContain('Verifique login e senha');
    expect(comp.enviando()).toBe(false);
  });

  it('chunk sumido no rebuild recarrega a aba, sem mostrar erro', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    });
    sessionStorage.clear();
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockRejectedValue(
      new Error('Failed to fetch dynamically imported module: /chunk-ABC.js'),
    );

    comp.form.setValue({ login: 'ana@rech.com.br', senha: 'segredo123', lembrar: false });
    await comp.enviar();

    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(comp.erro()).toBeNull();
  });

  it('desmarcar "Lembrar-me" apaga o e-mail guardado antes', async () => {
    localStorage.setItem(CHAVE_LOGIN_LEMBRADO, 'ana@rech.com.br');
    const fixture = montar();
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    // O campo já abre preenchido com o que foi lembrado, e a caixa marcada.
    expect(comp.form.getRawValue().login).toBe('ana@rech.com.br');
    expect(comp.form.getRawValue().lembrar).toBe(true);

    comp.form.patchValue({ senha: 'segredo123', lembrar: false });
    await comp.enviar();

    expect(localStorage.getItem(CHAVE_LOGIN_LEMBRADO)).toBeNull();
  });

  it('quem é só Comercial cai na consulta de cliente; os demais, na visão geral', async () => {
    const fixture = montar({ usuario: signal<AuthUser | null>(usuario(['Comercial'])) });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    comp.form.setValue({ login: 'com@rech.com.br', senha: 'segredo123', lembrar: false });
    await comp.enviar();

    expect(navegar).toHaveBeenCalledWith('/clientes/novo');
  });
});
