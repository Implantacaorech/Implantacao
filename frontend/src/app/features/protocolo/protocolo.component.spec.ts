import { TestBed } from '@angular/core/testing';
import { ProtocoloComponent } from './protocolo.component';
import { ProtocoloService } from '../../core/services/protocolo.service';

/** Stub do service para o painel embutido não tentar falar HTTP no teste. */
const serviceFake: Partial<ProtocoloService> = {
  clientesComProtocolo: () => Promise.resolve([]),
  credencialPortal: () => Promise.resolve({ tem: false, login: '' }),
};

function montar() {
  TestBed.configureTestingModule({
    imports: [ProtocoloComponent],
    providers: [{ provide: ProtocoloService, useValue: serviceFake }],
  });
  const fixture = TestBed.createComponent(ProtocoloComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ProtocoloComponent', () => {
  it('embute o Portal Rech na tela (iframe apontando para o login)', () => {
    const fixture = montar();
    const iframe = fixture.nativeElement.querySelector(
      'iframe.proto-frame',
    ) as HTMLIFrameElement | null;
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toBe('https://portalrech.com.br/login');
  });

  it('oferece a abertura em nova guia com noopener', () => {
    const fixture = montar();
    const link = fixture.nativeElement.querySelector(
      'a[target="_blank"]',
    ) as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toBe('https://portalrech.com.br/login');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('o painel Preencher protocolo só aparece após clicar no botão', () => {
    const fixture = montar();
    expect(
      fixture.nativeElement.querySelector('app-preencher-protocolo'),
    ).toBeFalsy();
    const botao = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) =>
      (b as HTMLButtonElement).textContent?.includes('Preencher protocolo'),
    ) as HTMLButtonElement | undefined;
    expect(botao).toBeTruthy();
    botao!.click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-preencher-protocolo'),
    ).toBeTruthy();
  });

  it('ao criar a visita, fecha o painel e recarrega o iframe para a lista do Portal', () => {
    const fixture = montar();
    fixture.componentInstance.mostrarPreencher.set(true);
    fixture.detectChanges();

    fixture.componentInstance.onProtocoloCriado();
    fixture.detectChanges();

    expect(fixture.componentInstance.mostrarPreencher()).toBe(false);
    const iframe = fixture.nativeElement.querySelector(
      'iframe.proto-frame',
    ) as HTMLIFrameElement;
    expect(iframe.src).toContain('/protocolo/lista');
  });
});
