import { TestBed } from '@angular/core/testing';
import { PreencherProtocoloComponent } from './preencher-protocolo.component';
import { ProtocoloService } from '../../core/services/protocolo.service';
import {
  ClienteComProtocolo,
  ListaProtocolos,
  Protocolo,
  RascunhoVisita,
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
    ...over,
  };
  TestBed.configureTestingModule({
    imports: [PreencherProtocoloComponent],
    providers: [{ provide: ProtocoloService, useValue: fake }],
  });
  return TestBed.createComponent(PreencherProtocoloComponent);
}

describe('PreencherProtocoloComponent', () => {
  it('carrega os clientes com protocolo ao abrir', async () => {
    const fixture = montar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ACME');
  });

  it('ao escolher cliente e protocolo, monta e exibe o rascunho', async () => {
    const fixture = montar();
    const comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await comp.onClienteAlterado('ACME');
    expect(comp.protocolos().length).toBe(1);

    await comp.onProtocoloAlterado('42');
    fixture.detectChanges();
    const txt = fixture.nativeElement.textContent as string;
    expect(txt).toContain('- PARTICIPANTES:');
    expect(txt).toContain('- TAREFAS/OBSERVAÇÕES:');
    expect(txt).toContain('Fiscal · 1.4-I');
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
