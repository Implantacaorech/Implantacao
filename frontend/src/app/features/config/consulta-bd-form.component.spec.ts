import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ConsultaBdFormComponent } from './consulta-bd-form.component';
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

describe('ConsultaBdFormComponent', () => {
  function montar(slug: string, service: Partial<ConsultaBdService>) {
    TestBed.configureTestingModule({
      imports: [ConsultaBdFormComponent],
      providers: [
        provideRouter([]),
        { provide: ConsultaBdService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ slug }) } } },
      ],
    });
    return TestBed.createComponent(ConsultaBdFormComponent);
  }

  it('modo criação: envia o slug informado, sem chamar atualizar', async () => {
    const criar = vi.fn().mockResolvedValue(consulta({ slug: 'nova' }));
    const fixture = montar('novo', { criar });
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    comp.form.patchValue({ nome: 'Nova', slug: 'nova', sql: 'SELECT 1' });
    await comp.salvar();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Nova', slug: 'nova', sql: 'SELECT 1' }));
  });

  it('modo edição: carrega a consulta e não envia o campo slug ao atualizar', async () => {
    const obter = vi.fn().mockResolvedValue(consulta());
    const atualizar = vi.fn().mockResolvedValue(consulta());
    const fixture = montar('previsao-inicio', { obter, atualizar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(comp.form.getRawValue().nome).toBe('Previsão Início Oficial');
    await comp.salvar();
    expect(atualizar).toHaveBeenCalledWith('previsao-inicio', expect.not.objectContaining({ slug: expect.anything() }));
  });

  it('testar mostra o resultado da execução', async () => {
    const obter = vi.fn().mockResolvedValue(consulta());
    const testar = vi.fn().mockResolvedValue({ ok: true, mensagem: '3 linha(s).', colunas: ['A'], linhas: [{ A: 1 }] });
    const fixture = montar('previsao-inicio', { obter, testar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.testar();
    expect(fixture.componentInstance.resultadoTeste()?.mensagem).toBe('3 linha(s).');
  });
});
