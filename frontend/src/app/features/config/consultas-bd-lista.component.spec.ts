import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConsultasBdListaComponent } from './consultas-bd-lista.component';
import { ConsultaBdService } from '../../core/services/consulta-bd.service';
import { ConsultaBD } from '../../core/models/consulta-bd.model';

function consulta(over: Partial<ConsultaBD> = {}): ConsultaBD {
  return {
    id: 1,
    slug: 'previsao-inicio',
    nome: 'Previsão Início Oficial',
    sql: 'SELECT 1',
    ordem: 0,
    colunaData: 'DATA',
    colunaSituacao: '',
    mostrarGrafico: true,
    ...over,
  };
}

describe('ConsultasBdListaComponent', () => {
  function montar(service: Partial<ConsultaBdService>) {
    TestBed.configureTestingModule({
      imports: [ConsultasBdListaComponent],
      providers: [provideRouter([]), { provide: ConsultaBdService, useValue: service }],
    });
    return TestBed.createComponent(ConsultasBdListaComponent);
  }

  it('lista as consultas salvas', async () => {
    const fixture = montar({ listar: () => Promise.resolve([consulta()]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Previsão Início Oficial');
  });

  it('mostra "Nenhuma consulta cadastrada." quando a lista vem vazia', async () => {
    const fixture = montar({ listar: () => Promise.resolve([]) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma consulta cadastrada.');
  });

  it('excluir chama o backend e recarrega a lista', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const excluir = vi.fn().mockResolvedValue(undefined);
    const listar = vi.fn().mockResolvedValue([consulta()]);
    const fixture = montar({ listar, excluir });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.excluir('previsao-inicio');
    expect(excluir).toHaveBeenCalledWith('previsao-inicio');
    expect(listar).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });
});
