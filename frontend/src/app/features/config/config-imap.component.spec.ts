import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigImapComponent } from './config-imap.component';
import { ConfigImapService } from '../../core/services/config-imap.service';
import { StatusConfigImap } from '../../core/models/config-imap.model';

function status(over: Partial<StatusConfigImap> = {}): StatusConfigImap {
  return {
    host: 'outlook.office365.com',
    port: '993',
    user: 'implantacao@rech.com.br',
    pasta: 'INBOX',
    configurado: true,
    ...over,
  };
}

describe('ConfigImapComponent', () => {
  function montar(service: Partial<ConfigImapService>) {
    TestBed.configureTestingModule({
      imports: [ConfigImapComponent],
      providers: [provideRouter([]), { provide: ConfigImapService, useValue: service }],
    });
    return TestBed.createComponent(ConfigImapComponent);
  }

  it('pré-preenche o formulário com a config atual, sem senha', async () => {
    const fixture = montar({ status: () => Promise.resolve(status()) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.form.getRawValue().host).toBe('outlook.office365.com');
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

  it('mostra erro quando salvar falha', async () => {
    const salvar = vi.fn().mockRejectedValue(new Error('falhou'));
    const fixture = montar({ status: () => Promise.resolve(status()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.salvar();
    expect(fixture.componentInstance.erro()).toBe('Não foi possível salvar a configuração.');
  });
});
