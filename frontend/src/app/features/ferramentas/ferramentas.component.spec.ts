import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FerramentasComponent } from './ferramentas.component';

describe('FerramentasComponent', () => {
  function montar() {
    TestBed.configureTestingModule({
      imports: [FerramentasComponent],
      providers: [provideRouter([])],
    });
    return TestBed.createComponent(FerramentasComponent);
  }

  it('traz a seção "Configurações e saúde" que saiu da Visão Geral', () => {
    const fixture = montar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Configurações e saúde');
  });

  it('mantém o acesso às telas de configuração e aos padrões de e-mail', () => {
    // Os dois últimos entraram em 2026-07-30: a tela de Modelos de E-mail existia e
    // funcionava, mas tinha ficado ÓRFÃ (rota sem link em lugar nenhum do menu) — foi o
    // "padrão de e-mail que perdemos no caminho". Destinatários por Passo é a companheira
    // dela: um define o texto, o outro define quem recebe.
    const fixture = montar();
    fixture.detectChanges();
    const destinos = Array.from(
      fixture.nativeElement.querySelectorAll('a.tool') as NodeListOf<HTMLAnchorElement>,
    ).map((a) => a.getAttribute('href'));
    expect(destinos).toEqual([
      '/config/email',
      '/config/imap',
      '/config/gmail',
      '/config/ia',
      '/config/modelos-email',
      '/config/destinatarios-passo',
    ]);
  });

  it('traz a seção "Padrões de e-mail"', () => {
    const fixture = montar();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Padrões de e-mail');
  });
});
