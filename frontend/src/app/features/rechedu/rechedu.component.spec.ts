import { TestBed } from '@angular/core/testing';
import { RecheduComponent } from './rechedu.component';
import { RecheduService } from '../../core/services/rechedu.service';
import { StatusCredencialRechEdu } from '../../core/models/rechedu.model';

/** Stub do service para a tela não tentar falar HTTP no teste; registra o que foi salvo. */
function stub(inicial: StatusCredencialRechEdu) {
  const chamadas: { login: string; senha: string }[] = [];
  const svc: Partial<RecheduService> = {
    credencial: () => Promise.resolve(inicial),
    salvarCredencial: (login: string, senha: string) => {
      chamadas.push({ login, senha });
      return Promise.resolve({ tem: true, login });
    },
    removerCredencial: () => Promise.resolve(),
  };
  return { svc, chamadas };
}

async function montar(inicial: StatusCredencialRechEdu = { tem: false, login: '' }) {
  const { svc, chamadas } = stub(inicial);
  TestBed.configureTestingModule({
    imports: [RecheduComponent],
    providers: [{ provide: RecheduService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(RecheduComponent);
  fixture.detectChanges();
  await fixture.whenStable(); // ngOnInit assíncrono (consulta da credencial)
  fixture.detectChanges();
  return { fixture, chamadas };
}

describe('RecheduComponent', () => {
  it('embute o RechEdu na tela (iframe apontando para o portal)', async () => {
    const { fixture } = await montar();
    const iframe = fixture.nativeElement.querySelector(
      'iframe.redu-frame',
    ) as HTMLIFrameElement | null;
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toBe('https://www.rechedu.com.br');
  });

  it('oferece a abertura em nova guia com noopener', async () => {
    const { fixture } = await montar();
    const link = fixture.nativeElement.querySelector(
      'a[target="_blank"]',
    ) as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toBe('https://www.rechedu.com.br');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('solicita a credencial no 1º uso (sem credencial salva)', async () => {
    const { fixture } = await montar({ tem: false, login: '' });
    expect(fixture.componentInstance.pedindoCredencial()).toBe(true);
    expect(fixture.nativeElement.querySelector('.redu-cred')).toBeTruthy();
  });

  it('com credencial salva, mostra "conectado como" em vez da captura', async () => {
    const { fixture } = await montar({ tem: true, login: 'consultor@rech.com.br' });
    expect(fixture.componentInstance.pedindoCredencial()).toBe(false);
    expect(fixture.nativeElement.querySelector('.redu-cred')).toBeFalsy();
    const faixa = fixture.nativeElement.querySelector('.redu-cred-info');
    expect(faixa?.textContent).toContain('consultor@rech.com.br');
  });

  it('salvar exige senha no 1º cadastro e envia login+senha ao backend', async () => {
    const { fixture, chamadas } = await montar({ tem: false, login: '' });
    const comp = fixture.componentInstance;

    comp.formLogin.set('consultor@rech.com.br');
    await comp.salvarCredencial();
    expect(chamadas.length).toBe(0); // sem senha no 1º cadastro, não chama o backend
    expect(comp.erroCred()).toContain('senha');

    comp.formSenha.set('segredo123');
    await comp.salvarCredencial();
    expect(chamadas).toEqual([
      { login: 'consultor@rech.com.br', senha: 'segredo123' },
    ]);
    expect(comp.temCredencial()).toBe(true);
    expect(comp.pedindoCredencial()).toBe(false);
    expect(comp.formSenha()).toBe(''); // a senha não fica retida na tela
  });

  it('"trocar" reabre a captura com o login atual preenchido', async () => {
    const { fixture } = await montar({ tem: true, login: 'consultor@rech.com.br' });
    const comp = fixture.componentInstance;
    comp.trocarCredencial();
    expect(comp.pedindoCredencial()).toBe(true);
    expect(comp.formLogin()).toBe('consultor@rech.com.br');
    expect(comp.formSenha()).toBe('');
  });
});
