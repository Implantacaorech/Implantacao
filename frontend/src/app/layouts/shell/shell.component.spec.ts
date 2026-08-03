import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import { AuthUser } from '../../core/models/auth-user.model';

const USUARIO = {
  sub: 1,
  login: 'everton@rech.com.br',
  nome: 'Everton',
  perfil: 'ADM',
  perfis: ['ADM'],
  codigoSicla: '007',
} as AuthUser;

describe('ShellComponent — barra superior', () => {
  function montar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { usuario: signal<AuthUser | null>(USUARIO), logout: vi.fn() },
        },
        {
          provide: PermissoesService,
          useValue: { garantirCarregado: vi.fn(), podeVer: () => true },
        },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('leva o logo Portal Rech para a barra, e não repete a marca no menu lateral', () => {
    const el: HTMLElement = montar().nativeElement;
    const marca: HTMLImageElement | null = el.querySelector('.topbar-marca img');
    expect(marca?.getAttribute('src')).toBe('logo-portal-rech-branco.png');
    expect(el.querySelector('.side-marca')).toBeNull();
  });

  it('escreve "Implantação SIGER®" abaixo do logo', () => {
    const el: HTMLElement = montar().nativeElement;
    expect(el.querySelector('.topbar-marca small')?.textContent).toBe('Implantação SIGER®');
  });

  it('identifica a pessoa pelo nome e pelo e-mail no cartão do usuário', () => {
    const el: HTMLElement = montar().nativeElement;
    const cartao: HTMLElement | null = el.querySelector('.topbar-perfil');
    expect(cartao?.textContent).toContain('Everton');
    expect(cartao?.textContent).toContain('everton@rech.com.br');
  });

  it('o Sair é o botão vermelho próprio, não mais um ícone da barra', () => {
    const el: HTMLElement = montar().nativeElement;
    expect(el.querySelector('button.topbar-sair')).not.toBeNull();
  });

  /** Defeito relatado em 2026-07-30: "Matriz por Menu - Funç…" saía cortado na barra. O
   * teto de largura foi removido no CSS do shell; o `title` é a rede de segurança — mesmo
   * que a janela aperte a ponto de reticenciar, o texto inteiro fica alcançável. */
  it('o nome da tela carrega o texto inteiro no title (nada de corte silencioso)', () => {
    const fixture = montar();
    const el: HTMLElement = fixture.nativeElement;
    const titulo: HTMLElement | null = el.querySelector('.topbar-title');
    expect(titulo?.getAttribute('title')).toBe(fixture.componentInstance.tituloPagina());
  });
});
