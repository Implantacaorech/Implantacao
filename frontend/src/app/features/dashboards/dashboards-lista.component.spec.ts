import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardsListaComponent } from './dashboards-lista.component';
import { DashboardsService } from '../../core/services/dashboards.service';

describe('DashboardsListaComponent', () => {
  function montar(service: Partial<DashboardsService>) {
    TestBed.configureTestingModule({
      imports: [DashboardsListaComponent],
      providers: [provideRouter([]), { provide: DashboardsService, useValue: service }],
    });
    return TestBed.createComponent(DashboardsListaComponent);
  }

  it('lista os dashboards disponíveis', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([{ id: 1, slug: 'previsao-inicio', nome: 'Previsão Início Oficial', mostrarGrafico: true }]),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Previsão Início Oficial');
  });

  it('mostra mensagem explicativa quando não há dashboards configurados', async () => {
    const fixture = montar({ listar: () => Promise.resolve([]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma consulta configurada como dashboard');
  });
});
