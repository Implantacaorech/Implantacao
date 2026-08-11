import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MonitoramentoComponent } from './monitoramento.component';
import { AtividadeService } from '../../core/services/atividade.service';
import { ResultadoMonitoramento } from '../../core/models/monitoramento.model';
import { SaudeService } from '../../core/services/saude.service';
import { ResultadoSaude } from '../../core/models/saude.model';

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

function saudeOk(over: Partial<ResultadoSaude> = {}): ResultadoSaude {
  return {
    nivel: 'ok',
    itens: [
      { chave: 'banco', titulo: 'Banco de dados', nivel: 'ok', mensagem: 'Conexão respondendo (mariadb).', detalhe: '' },
    ],
    verificadoEm: '2026-08-11T12:00:00.000Z',
    ...over,
  };
}

describe('MonitoramentoComponent', () => {
  function montar(service: Partial<AtividadeService>, saude: Partial<SaudeService> = {}) {
    TestBed.configureTestingModule({
      imports: [MonitoramentoComponent],
      providers: [
        provideRouter([]),
        { provide: AtividadeService, useValue: service },
        {
          provide: SaudeService,
          useValue: { diagnostico: () => Promise.resolve(saudeOk()), ...saude },
        },
      ],
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

  /** O bloco de saúde da INFRAESTRUTURA (backup, Guardião, docservice) — separado do score
   * de saúde dos projetos. É o único lugar do sistema onde uma falha silenciosa de operação
   * fica visível: todo incidente sério deste projeto passou dias num log que ninguém abria. */
  describe('saúde do sistema', () => {
    it('lista cada checagem com a mensagem e o que fazer', async () => {
      const fixture = montar(
        { monitoramento: () => Promise.resolve(resultado()) },
        {
          diagnostico: () =>
            Promise.resolve(
              saudeOk({
                nivel: 'critico',
                itens: [
                  {
                    chave: 'backup',
                    titulo: 'Backup do banco',
                    nivel: 'critico',
                    mensagem: 'O último backup é de 72 h atrás.',
                    detalhe: 'Confira a Tarefa Agendada.',
                  },
                ],
              }),
            ),
        },
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Saúde do sistema');
      expect(texto).toContain('O último backup é de 72 h atrás.');
      expect(texto).toContain('Confira a Tarefa Agendada.');
      expect(texto).toContain('Crítico');
    });

    /** O diagnóstico bate no docservice, que quando está fora só responde no timeout — e é
     * justamente aí que ele mais importa. A tela não pode ficar refém disso. */
    it('falha no diagnóstico não derruba o Monitoramento', async () => {
      const fixture = montar(
        { monitoramento: () => Promise.resolve(resultado()) },
        { diagnostico: () => Promise.reject(new Error('503')) },
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const texto = fixture.nativeElement.textContent as string;
      expect(texto).toContain('Não foi possível verificar a saúde do sistema agora.');
      expect(texto).toContain('Comercial'); // o resto da tela continua de pé
      expect(texto).not.toContain('Não foi possível carregar o Monitoramento Operacional.');
    });
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
