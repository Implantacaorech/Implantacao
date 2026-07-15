import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { DefinirGciComponent } from './definir-gci.component';
import { DesignacaoService } from '../../core/services/designacao.service';
import { DefinirGciView } from '../../core/models/designacao.model';

describe('DefinirGciComponent', () => {
  function montar(service: Partial<DesignacaoService>) {
    TestBed.configureTestingModule({
      imports: [DefinirGciComponent],
      providers: [
        provideRouter([]),
        { provide: DesignacaoService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(DefinirGciComponent);
  }

  function view(over: Partial<DefinirGciView> = {}): DefinirGciView {
    return { gciAtual: '', gcis: ['Ana', 'Beto'], ...over };
  }

  it('pré-marca os GCIs já definidos no projeto', async () => {
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view({ gciAtual: 'Ana' })) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.marcado('Ana')).toBe(true);
    expect(comp.marcado('Beto')).toBe(false);
  });

  it('não permite salvar sem nenhum GCI selecionado', async () => {
    const definirGci = vi.fn();
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view()), definirGci });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(definirGci).not.toHaveBeenCalled();
  });

  it('salva os GCIs selecionados e navega para o projeto', async () => {
    const definirGci = vi.fn().mockResolvedValue({});
    const fixture = montar({ obterDefinirGci: () => Promise.resolve(view()), definirGci });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.alternar('Ana', true);
    await comp.salvar();
    expect(definirGci).toHaveBeenCalledWith(5, ['Ana']);
    expect(navigateSpy).toHaveBeenCalledWith(['/projetos', 5]);
  });
});
