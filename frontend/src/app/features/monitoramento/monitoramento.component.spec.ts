import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MonitoramentoComponent } from './monitoramento.component';
import { AtividadeService } from '../../core/services/atividade.service';
import { ResultadoMonitoramento } from '../../core/models/monitoramento.model';

function resultado(over: Partial<ResultadoMonitoramento> = {}): ResultadoMonitoramento {
  return {
    m: {
      total: 5,
      ativos: 4,
      concluidos: 1,
      porSituacao: {},
      porEtapa: {},
      atrasados: [],
      nAtrasados: 1,
      emRisco: [],
      nRisco: 0,
      gatePendente: 2,
      noPrazo: 3,
      consultores: [],
      horasCob: 0,
      horasBon: 0,
      horasTotal: 0,
      ttvMedio: null,
    },
    alertas: [],
    setores: [
      {
        nome: 'Comercial',
        estado: 'normal',
        estadoLabel: 'Trabalhando normalmente',
        andamento: 2,
        concluidas: 3,
        pendentes: 0,
        atrasadas: 0,
        aprovacao: 0,
        responsaveis: ['Ana'],
        tempoMedio: 5,
        alertas: [],
      },
    ],
    saude: 85,
    fluxo: [{ nome: 'Agendamento', n: 2, pct: 40 }],
    mapa: [],
    entregas: [],
    carga: [],
    atualizadoEm: '15/07/2026 09:00',
    chartSetores: { labels: [], pendentes: [], atrasadas: [], andamento: [] },
    ...over,
  };
}

describe('MonitoramentoComponent', () => {
  function montar(service: Partial<AtividadeService>) {
    TestBed.configureTestingModule({
      imports: [MonitoramentoComponent],
      providers: [provideRouter([]), { provide: AtividadeService, useValue: service }],
    });
    return TestBed.createComponent(MonitoramentoComponent);
  }

  it('mostra o score de saúde e o horário de atualização', async () => {
    const fixture = montar({ monitoramento: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('85');
    expect(texto).toContain('15/07/2026 09:00');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ monitoramento: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o Monitoramento Operacional.');
  });

  it('lista os setores com o rótulo de estado', async () => {
    const fixture = montar({ monitoramento: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Comercial');
    expect(texto).toContain('Trabalhando normalmente');
  });

  it('mostra o mapa de progresso com link para o projeto', async () => {
    const dados = resultado({
      mapa: [{ id: 3, cliente: 'Cliente Y', etapa: 'Projeto', situacao: 'Em andamento', progresso: 40, consultor: 'Ana', alertas: 0, risco: false, atrasado: false }],
    });
    const fixture = montar({ monitoramento: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cliente Y');
  });
});
