import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ApresentacaoComponent } from './apresentacao.component';

describe('ApresentacaoComponent', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [ApresentacaoComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ApresentacaoComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('tem no topo da janela um botão que leva ao login', () => {
    const el: HTMLElement = montar().nativeElement;
    const botao = el.querySelector<HTMLAnchorElement>('.ap-topo .ap-botao');
    expect(botao?.textContent?.trim()).toBe('Entrar no Painel');
    expect(botao?.getAttribute('href')).toBe('/login');
  });

  it('não depende de sessão: monta sem AuthService e sem chamar a API', () => {
    // O teste acima já monta o componente sem provider algum além do Router — se a página
    // exigisse login, aqui quebraria. Este caso deixa a intenção explícita.
    const el: HTMLElement = montar().nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('implantação de um cliente');
  });

  it('apresenta cada recurso com texto e imagem descrita', () => {
    const fixture = montar();
    const el: HTMLElement = fixture.nativeElement;
    const blocos = el.querySelectorAll('.ap-bloco');
    expect(blocos.length).toBe(fixture.componentInstance.recursos.length);

    for (const bloco of Array.from(blocos)) {
      expect(bloco.querySelector('h2')?.textContent?.trim()).toBeTruthy();
      expect(bloco.querySelectorAll('.ap-lista li').length).toBeGreaterThan(0);
      const img = bloco.querySelector('img');
      expect(img?.getAttribute('src')).toMatch(/^apresentacao\/.+\.svg$/);
      // Alt descritivo: a página é pública e precisa ser lida sem enxergar a imagem.
      expect(img?.getAttribute('alt')?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('repete a chamada para entrar no fim da página', () => {
    const el: HTMLElement = montar().nativeElement;
    const finais = el.querySelectorAll<HTMLAnchorElement>('.ap-final .ap-botao');
    expect(finais.length).toBe(1);
    expect(finais[0].getAttribute('href')).toBe('/login');
  });

  it('nomeia a aba do navegador', () => {
    montar();
    expect(TestBed.inject(Title).getTitle()).toContain('Painel de Implantação');
  });
});
