import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ConfigGmailComponent } from './config-gmail.component';
import { ConfigGmailService } from '../../core/services/config-gmail.service';

function ativarRotaComQuery(query: Record<string, string>) {
  return {
    snapshot: { queryParamMap: convertToParamMap(query) },
  };
}

describe('ConfigGmailComponent', () => {
  function montar(service: Partial<ConfigGmailService>, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ConfigGmailComponent],
      providers: [
        provideRouter([]),
        { provide: ConfigGmailService, useValue: service },
        { provide: ActivatedRoute, useValue: ativarRotaComQuery(query) },
      ],
    });
    return TestBed.createComponent(ConfigGmailComponent);
  }

  it('carrega o status (credencial + autorização)', async () => {
    const fixture = montar({
      status: () => Promise.resolve({ temCliente: true, autorizado: false }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.temCliente()).toBe(true);
    expect(fixture.componentInstance.autorizado()).toBe(false);
  });

  it('mostra aviso de sucesso quando volta do callback do Google com ?autorizado=1', async () => {
    const fixture = montar(
      { status: () => Promise.resolve({ temCliente: true, autorizado: true }) },
      { autorizado: '1' },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.aviso()).toContain('autorizada com sucesso');
  });

  it('mostra erro quando volta do callback do Google com ?erro=...', async () => {
    const fixture = montar(
      { status: () => Promise.resolve({ temCliente: true, autorizado: false }) },
      { erro: 'access_denied' },
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.erro()).toContain('access_denied');
  });

  it('enviarCliente chama o service com o arquivo selecionado', async () => {
    const enviarCliente = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({
      status: () => Promise.resolve({ temCliente: false, autorizado: false }),
      enviarCliente,
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const arquivo = new File(['{}'], 'client.json', { type: 'application/json' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [arquivo] });
    await fixture.componentInstance.enviarCliente({ target: input } as unknown as Event);

    expect(enviarCliente).toHaveBeenCalledWith(arquivo);
    expect(fixture.componentInstance.temCliente()).toBe(true);
  });
});
