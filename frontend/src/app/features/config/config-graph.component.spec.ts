import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigGraphComponent } from './config-graph.component';
import { ConfigGraphService } from '../../core/services/config-graph.service';
import { StatusConfigGraph } from '../../core/models/config-graph.model';

function status(over: Partial<StatusConfigGraph> = {}): StatusConfigGraph {
  return {
    tenantId: 'tenant-uuid',
    clientId: 'client-uuid',
    remetente: 'implantacao@rech.com.br',
    temSegredo: true,
    configurado: true,
    ...over,
  };
}

describe('ConfigGraphComponent', () => {
  function montar(service: Partial<ConfigGraphService>) {
    TestBed.configureTestingModule({
      imports: [ConfigGraphComponent],
      providers: [provideRouter([]), { provide: ConfigGraphService, useValue: service }],
    });
    return TestBed.createComponent(ConfigGraphComponent);
  }

  it('pré-preenche o formulário com a config atual, sem o segredo', async () => {
    const fixture = montar({ status: () => Promise.resolve(status()) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.form.getRawValue().tenantId).toBe('tenant-uuid');
    expect(comp.form.getRawValue().clientSecret).toBe('');
    expect(comp.configurado()).toBe(true);
    expect(comp.temSegredo()).toBe(true);
  });

  it('salvar omite o segredo do payload quando em branco', async () => {
    const salvar = vi.fn().mockResolvedValue(status());
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith(
      expect.not.objectContaining({ clientSecret: expect.anything() }),
    );
  });

  it('salvar inclui o segredo quando preenchido', async () => {
    const salvar = vi.fn().mockResolvedValue(status());
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.form.patchValue({ clientSecret: 'segredo-novo' });
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: 'segredo-novo' }));
  });

  it('mostra erro quando salvar falha', async () => {
    const salvar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(fixture.componentInstance.erro()).toBe('Não foi possível salvar a configuração.');
  });

  it('config incompleta aparece como incompleta na tela', async () => {
    const fixture = montar({
      status: () => Promise.resolve(status({ configurado: false, temSegredo: false })),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Incompleto');
  });
});
