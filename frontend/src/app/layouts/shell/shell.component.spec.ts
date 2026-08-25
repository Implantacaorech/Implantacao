import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { AuthService } from '../../core/services/auth.service';
import { PermissoesService } from '../../core/services/permissoes.service';
import {
  Instancia,
  InstanciaService,
  PerfilInstancia,
} from '../../core/services/instancia.service';
import { AuthUser } from '../../core/models/auth-user.model';

const USUARIO = {
  sub: 1,
  login: 'everton@rech.com.br',
  nome: 'Everton',
  perfil: 'ADM',
  perfis: ['ADM'],
  codigoSicla: '007',
} as AuthUser;

const INSTANCIAS: Record<PerfilInstancia, Instancia> = {
  painel: {
    perfil: 'painel',
    nome: 'Painel de Implantação',
    descricao: '',
    rotaInicial: '/home',
  },
  'portal-api': {
    perfil: 'portal-api',
    nome: 'Portal API',
    descricao: '',
    rotaInicial: '/config/api-dados',
  },
};

describe('ShellComponent — barra superior', () => {
  function montar(perfil: PerfilInstancia = 'painel') {
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
        {
          provide: InstanciaService,
          useValue: {
            garantirCarregado: vi.fn(),
            atual: signal(INSTANCIAS[perfil]),
            portalApi: signal(perfil === 'portal-api'),
          },
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

/** O menu do **Portal API** é outro, e é curto de propósito: aquela instância monta só a API
 * de Dados. Mostrar ali os itens do Painel seria oferecer porta que não abre — os módulos
 * por trás delas não existem naquele processo. */
describe('ShellComponent — menu por instância', () => {
  function montar(perfil: PerfilInstancia) {
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
        {
          provide: InstanciaService,
          useValue: {
            garantirCarregado: vi.fn(),
            atual: signal(INSTANCIAS[perfil]),
            portalApi: signal(perfil === 'portal-api'),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const links = (el: HTMLElement): string[] =>
    [...el.querySelectorAll('.side-nav .side-link')].map((a) =>
      (a.textContent ?? '').trim(),
    );

  it('no Portal API o menu tem SÓ conexão, consultas e token', () => {
    const el = montar('portal-api');
    const itens = links(el);
    expect(itens).toEqual([
      'Conexões Dados de acesso aos bancos',
      'Consultas da API O que a API entrega, e com quais parâmetros',
      'Nova consulta',
      'Tokens Gerar e revogar o acesso de cada consumidor',
    ]);
  });

  it('no Portal API não sobra nada do Painel no menu', () => {
    const texto = montar('portal-api').querySelector('.side-nav')?.textContent ?? '';
    for (const ausente of [
      'Carteira',
      'Protocolos',
      'Usuários',
      'Prontidão',
      'Assistente',
      'Matriz',
    ]) {
      expect(texto).not.toContain(ausente);
    }
  });

  it('no Portal API a barra não oferece busca de cliente nem alertas', () => {
    // Não existe cliente nem alerta naquela instância — o campo abriria uma tela ausente.
    const el = montar('portal-api');
    expect(el.querySelector('.topbar-busca')).toBeNull();
    expect(el.querySelector('.topbar-ico')).toBeNull();
    expect(el.querySelector('.topbar-marca small')?.textContent).toBe('Portal API');
  });

  it('no Painel o menu continua completo', () => {
    const texto = montar('painel').querySelector('.side-nav')?.textContent ?? '';
    expect(texto).toContain('Carteira');
    expect(texto).toContain('Usuários');
    // E ganhou a entrada nova, do lado consumidor.
    expect(texto).toContain('Tokens da API de Dados');
  });
});
