import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigEmailComponent } from './config-email.component';
import { ConfigEmailService } from '../../core/services/config-email.service';
import { StatusConfigEmail } from '../../core/models/config-email.model';

function status(over: Partial<StatusConfigEmail> = {}): StatusConfigEmail {
  return {
    host: 'smtp.gmail.com',
    port: '587',
    user: 'implantacao@rech.com.br',
    remetente: 'implantacao@rech.com.br',
    useTls: true,
    configurado: true,
    ...over,
  };
}

describe('ConfigEmailComponent', () => {
  function montar(service: Partial<ConfigEmailService>) {
    TestBed.configureTestingModule({
      imports: [ConfigEmailComponent],
      providers: [provideRouter([]), { provide: ConfigEmailService, useValue: service }],
    });
    return TestBed.createComponent(ConfigEmailComponent);
  }

  it('pré-preenche o formulário com a config atual, sem senha', async () => {
    const fixture = montar({ status: () => Promise.resolve(status()) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.form.getRawValue().host).toBe('smtp.gmail.com');
    expect(comp.form.getRawValue().senha).toBe('');
    expect(comp.configurado()).toBe(true);
  });

  it('salvar omite a senha do payload quando em branco', async () => {
    const salvar = vi.fn().mockResolvedValue(status());
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith(expect.not.objectContaining({ senha: expect.anything() }));
  });

  it('salvar inclui a senha quando preenchida', async () => {
    const salvar = vi.fn().mockResolvedValue(status());
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.form.patchValue({ senha: 'nova-senha-de-app' });
    await fixture.componentInstance.salvar();
    expect(salvar).toHaveBeenCalledWith(expect.objectContaining({ senha: 'nova-senha-de-app' }));
  });

  it('mostra erro quando salvar falha', async () => {
    const salvar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(fixture.componentInstance.erro()).toBe('Não foi possível salvar a configuração.');
  });
});
