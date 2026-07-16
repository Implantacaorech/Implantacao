import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigIaComponent } from './config-ia.component';
import { ConfigIaService } from '../../core/services/config-ia.service';

describe('ConfigIaComponent', () => {
  function montar(service: Partial<ConfigIaService>) {
    TestBed.configureTestingModule({
      imports: [ConfigIaComponent],
      providers: [provideRouter([]), { provide: ConfigIaService, useValue: service }],
    });
    return TestBed.createComponent(ConfigIaComponent);
  }

  it('carrega o status atual', async () => {
    const fixture = montar({
      status: () => Promise.resolve({ ativa: true, modelo: 'claude-sonnet-5', viaEnv: false }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ativa()).toBe(true);
    expect(fixture.componentInstance.modelo()).toBe('claude-sonnet-5');
  });

  it('salvar envia a chave digitada', async () => {
    const salvar = vi.fn().mockResolvedValue({ ativa: true, modelo: 'claude-sonnet-5', viaEnv: false });
    const fixture = montar({
      status: () => Promise.resolve({ ativa: false, modelo: '', viaEnv: false }),
      salvar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.form.patchValue({ apiKey: 'sk-ant-teste' });
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith('sk-ant-teste');
    expect(fixture.componentInstance.ativa()).toBe(true);
  });

  it('nao salva quando a chave vem de variavel de ambiente (viaEnv)', async () => {
    const salvar = vi.fn();
    const fixture = montar({
      status: () => Promise.resolve({ ativa: true, modelo: 'claude-sonnet-5', viaEnv: true }),
      salvar,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(salvar).not.toHaveBeenCalled();
  });
});
