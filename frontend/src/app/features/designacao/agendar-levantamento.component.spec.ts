import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AgendarLevantamentoComponent } from './agendar-levantamento.component';
import { DesignacaoService } from '../../core/services/designacao.service';
import { AgendarView } from '../../core/models/designacao.model';

describe('AgendarLevantamentoComponent', () => {
  function montar(service: Partial<DesignacaoService>) {
    TestBed.configureTestingModule({
      imports: [AgendarLevantamentoComponent],
      providers: [
        provideRouter([]),
        { provide: DesignacaoService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(AgendarLevantamentoComponent);
  }

  function view(over: Partial<AgendarView> = {}): AgendarView {
    return { gci: 'Ana', dataLevantamento: '', hojeIso: '2026-07-15', ...over };
  }

  it('mostra o GCI responsável carregado', async () => {
    const fixture = montar({ obterAgendar: () => Promise.resolve(view({ gci: 'Ana, Beto' })) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ana, Beto');
  });

  it('pré-preenche a data já agendada, se houver', async () => {
    const fixture = montar({ obterAgendar: () => Promise.resolve(view({ dataLevantamento: '2026-08-10' })) });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.form.getRawValue().dataLevantamento).toBe('2026-08-10');
  });

  it('salva a data e navega para o projeto', async () => {
    const agendar = vi.fn().mockResolvedValue({});
    const fixture = montar({ obterAgendar: () => Promise.resolve(view()), agendar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.form.setValue({ dataLevantamento: '2026-08-10' });
    await comp.salvar();
    expect(agendar).toHaveBeenCalledWith(5, '2026-08-10');
    expect(navigateSpy).toHaveBeenCalledWith(['/projetos', 5]);
  });

  it('mostra mensagem de erro quando o agendamento falha', async () => {
    const agendar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ obterAgendar: () => Promise.resolve(view()), agendar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.form.setValue({ dataLevantamento: '2026-08-10' });
    await comp.salvar();
    expect(comp.erro()).toBe('Não foi possível agendar o levantamento.');
  });
});
