import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth-user.model';
import { CHAVE_LOGIN_LEMBRADO } from '../../core/constants/sessao';

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
  function montar(authService: Partial<AuthService> = {}) {
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
      ],
    });
    return TestBed.createComponent(LoginComponent);
  }

  beforeEach(() => {
    localStorage.removeItem(CHAVE_LOGIN_LEMBRADO);
    TestBed.resetTestingModule();
  });

  it('traz o logo Portal Rech e "Implantação SIGER®" abaixo', () => {
    const fixture = montar();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('img.acesso-logo')?.getAttribute('src')).toBe(
      'logo-portal-rech-azul.png',
    );
    expect(el.querySelector('.acesso-sub')?.textContent).toBe('Implantação SIGER®');
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

  it('oferece a apresentação dos recursos, alcançável sem login', () => {
    const fixture = montar();
    fixture.detectChanges();
    const botao: HTMLAnchorElement = fixture.nativeElement.querySelector('.login-apresentacao');
    expect(botao.textContent?.trim()).toBe('Conheça os recursos do Painel');
    expect(botao.getAttribute('href')).toBe('/apresentacao');
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
