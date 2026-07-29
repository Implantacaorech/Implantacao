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

  it('mantém o acesso às quatro telas de configuração', () => {
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
    ]);
  });
});
