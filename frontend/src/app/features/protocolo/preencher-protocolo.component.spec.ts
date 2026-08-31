import { TestBed } from '@angular/core/testing';
import { PreencherProtocoloComponent } from './preencher-protocolo.component';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  ClienteComProtocolo,
  ListaProtocolos,
  Protocolo,
  RascunhoVisita,
  StatusCredencialPortal,
} from '../../core/models/protocolo.model';

function protoLista(status: string): ListaProtocolos {
  return {
    itens: [
      {
        id: 42,
        titulo: 'Treinamento Faturamento',
        assunto: '',
        modulo: 'Fiscal',
        menu: '1.4-I',
        status,
        criadoEm: '2026-08-10T14:00:00',
      } as Protocolo,
    ],
    roboOk: false,
    pasta: '',
    podeExcluir: false,
  };
}

const rascunho: RascunhoVisita = {
  protocoloId: 42,
  cliente: 'ACME',
  clienteCodigo: '5001',
  tituloProtocolo: 'Treinamento Faturamento',
  participantes: ['Ivian', 'João'],
  dataInicioSugerida: '2026-08-10T14:00',
  dataFimSugerida: '2026-08-10T15:00',
  duracaoSeg: 3600,
  origem: 'gravacao',
  status: 'Aprovado',
  atividade: {
    modulo: 'Fiscal',
    menu: '1.4-I',
    descricaoAtividade: '- PARTICIPANTES:\nIvian\nJoão\n\n- ROTINAS:\n1.4-I\n\n- TAREFAS/OBSERVAÇÕES:\nx',
  },
};

function montar(over: Partial<ProtocoloService> = {}) {
  const fake: Partial<ProtocoloService> = {
    clientesComProtocolo: () =>
      Promise.resolve<ClienteComProtocolo[]>([
        { cliente: 'ACME', clienteCodigo: '5001', total: 2 },
      ]),
    listar: () => Promise.resolve(protoLista('Aprovado')),
    rascunhoVisita: () => Promise.resolve(rascunho),
    credencialPortal: () =>
      Promise.resolve<StatusCredencialPortal>({ tem: false, login: '' }),
    salvarCredencialPortal: (login) =>
      Promise.resolve<StatusCredencialPortal>({ tem: true, login }),
    enviarPortal: () => Promise.resolve({ visitaId: 321 }),
    ...over,
  };
  TestBed.configureTestingModule({
    imports: [PreencherProtocoloComponent],
    providers: [{ provide: ProtocoloService, useValue: fake }],
  });
  return TestBed.createComponent(PreencherProtocoloComponent);
}

async function comProtocoloEscolhido(fixture: ReturnType<typeof montar>) {
  const comp = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  await comp.onProtocoloAlterado('42');
  return comp;
}

describe('PreencherProtocoloComponent', () => {
  it('carrega os clientes com protocolo ao abrir', async () => {
    const fixture = montar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ACME');
  });

  it('ao escolher cliente e protocolo, pré-preenche os campos editáveis', async () => {
    const fixture = montar();
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await comp.onClienteAlterado('ACME');
    expect(comp.protocolos().length).toBe(1);

    await comp.onProtocoloAlterado('42');
    expect(comp.clienteCodigo()).toBe('5001');
    expect(comp.contato()).toBe('Ivian');
    expect(comp.modulo()).toBe('Fiscal');
    expect(comp.inicioVisita()).toBe('2026-08-10T14:00');
    expect(comp.fimVisita()).toBe('2026-08-10T15:00');
    expect(comp.descricao()).toContain('- PARTICIPANTES:');
  });

  it('sem credencial, Iniciar preenchimento pede a credencial (não envia)', async () => {
    const fixture = montar();
    const comp = await comProtocoloEscolhido(fixture);
    const aberta = vi.spyOn(window, 'open').mockReturnValue(null);

    await comp.iniciarPreenchimento();
    expect(comp.pedindoCredencial()).toBe(true);
    expect(aberta).not.toHaveBeenCalled();
  });

  it('salva a credencial, cria a visita e emite `criada`', async () => {
    const enviarPortal = vi.fn().mockResolvedValue({ visitaId: 321 });
    const fixture = montar({ enviarPortal });
    const comp = await comProtocoloEscolhido(fixture);
    let criada: number | undefined;
    comp.criada.subscribe((v) => (criada = v));

    await comp.iniciarPreenchimento(); // abre a captura
    comp.formLogin.set('consultor.rech');
    comp.formSenha.set('segredo');
    await comp.salvarCredencialEContinuar();

    expect(comp.temCredencial()).toBe(true);
    expect(enviarPortal).toHaveBeenCalledWith(42, expect.objectContaining({
      clienteCodigo: '5001',
      dataInicioVisita: '2026-08-10T14:00',
      descricaoAtividade: expect.stringContaining('PARTICIPANTES'),
    }));
    expect(comp.visitaCriada()).toBe(321);
    expect(criada).toBe(321);
  });

  it('com credencial já salva, envia direto', async () => {
    const enviarPortal = vi.fn().mockResolvedValue({ visitaId: 55 });
    const fixture = montar({
      credencialPortal: () => Promise.resolve({ tem: true, login: 'consultor' }),
      enviarPortal,
    });
    const comp = await comProtocoloEscolhido(fixture);
    vi.spyOn(window, 'open').mockReturnValue(null);

    await comp.iniciarPreenchimento();
    expect(comp.pedindoCredencial()).toBe(false);
    expect(enviarPortal).toHaveBeenCalled();
    expect(comp.visitaCriada()).toBe(55);
  });

  it('avisa quando o cliente não tem transcrição revisada', async () => {
    const fixture = montar({
      listar: () => Promise.resolve(protoLista('Transcrevendo')),
    });
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await comp.onClienteAlterado('ACME');
    expect(comp.protocolos().length).toBe(0);
    expect(comp.erro()).toContain('ainda não tem');
  });
});
