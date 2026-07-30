import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiAbasPrincipaisComponent } from './bi-abas-principais.component';
import { PermissoesService } from '../../core/services/permissoes.service';

/** A área BI tem UMA entrada no menu lateral, mas dois BIs por trás com permissões
 * separadas: `dashboards` (BI Implantação) e `bi_implantacao` (Implantação Clientes SIGER).
 * Quem só tem um deles não pode ver a aba do outro. */
describe('BiAbasPrincipaisComponent', () => {
  function montar(liberados: string[]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiAbasPrincipaisComponent],
      providers: [
        provideRouter([]),
        {
          provide: PermissoesService,
          useValue: { podeVer: (m: string) => liberados.includes(m) },
        },
      ],
    });
    const f = TestBed.createComponent(BiAbasPrincipaisComponent);
    f.detectChanges();
    return f;
  }

  function abas(f: ReturnType<typeof montar>): string[] {
    return Array.from(f.nativeElement.querySelectorAll('a')).map((a) =>
      (a as HTMLAnchorElement).textContent?.trim() ?? '',
    );
  }

  it('mostra as duas abas quando o usuário tem os dois BIs', () => {
    const f = montar(['dashboards', 'bi_implantacao']);
    expect(abas(f)).toEqual(['BI Implantação', 'Implantação Clientes SIGER']);
  });

  it('só BI Implantação quando falta o outro', () => {
    const f = montar(['dashboards']);
    expect(abas(f)).toEqual(['BI Implantação']);
  });

  it('só Implantação Clientes SIGER quando falta o outro', () => {
    const f = montar(['bi_implantacao']);
    expect(abas(f)).toEqual(['Implantação Clientes SIGER']);
  });

  it('nenhuma aba sem permissão alguma', () => {
    const f = montar([]);
    expect(abas(f)).toEqual([]);
  });

  it('as abas apontam para as rotas da área BI', () => {
    const f = montar(['dashboards', 'bi_implantacao']);
    const hrefs = Array.from(f.nativeElement.querySelectorAll('a')).map((a) =>
      (a as HTMLAnchorElement).getAttribute('href'),
    );
    expect(hrefs).toEqual(['/bi/implantacao', '/bi/clientes-siger']);
  });
});
