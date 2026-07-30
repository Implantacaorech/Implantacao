import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiAlocacaoHorasComponent } from './bi-alocacao-horas.component';
import { BiAgendaAlocacaoService } from '../../core/services/bi-agenda-alocacao.service';
import {
  LinhaHorasAplicadasBi,
  ResultadoHorasAplicadasBi,
} from '../../core/models/bi-agenda-alocacao.model';

function linha(over: Partial<LinhaHorasAplicadasBi> = {}): LinhaHorasAplicadasBi {
  return {
    rns: 138846,
    fantasia: 'Cliente X',
    rnsDescricao: 'Cliente X - Implantação',
    responsavel: 'Kailan',
    tipoSuporte: 'Implantação',
    grupoEconomico: 'GRUPO X',
    qtdCompromissos: 3,
    horasEncaminhada: 0,
    horasAgendada: 1,
    horasRealizada: 8,
    horasNaoRealizada: 0,
    horasPostergada: 1,
    horasCancelada: 0,
    horasTotal: 10,
    percentualPostergada: 10,
    ...over,
  };
}

function resultado(over: Partial<ResultadoHorasAplicadasBi> = {}): ResultadoHorasAplicadasBi {
  return {
    competencias: { inicio: '2024-07', fim: '2026-07' },
    linhas: [linha()],
    totais: {
      rnsQuantidade: 1,
      horasEncaminhada: 0,
      horasAgendada: 1,
      horasRealizada: 8,
      horasNaoRealizada: 0,
      horasPostergada: 1,
      horasCancelada: 0,
      horasTotal: 10,
      percentualPostergada: 10,
    },
    filtros: { grupos: ['GRUPO X'], responsaveis: ['Kailan'], tiposSuporte: ['Implantação'] },
    selecionados: { grupos: [], responsaveis: [], tiposSuporte: [] },
    erro: null,
    ...over,
  };
}

describe('BiAlocacaoHorasComponent', () => {
  function montar(service: Partial<BiAgendaAlocacaoService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiAlocacaoHorasComponent],
      providers: [provideRouter([]), { provide: BiAgendaAlocacaoService, useValue: service }],
    });
    return TestBed.createComponent(BiAlocacaoHorasComponent);
  }

  async function pronto(service: Partial<BiAgendaAlocacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega e grava a janela de competência devolvida pelo backend', async () => {
    const comp = await pronto({ horasAplicadas: () => Promise.resolve(resultado()) });
    expect(comp.linhas()).toHaveLength(1);
    expect(comp.compIni).toBe('2024-07');
    expect(comp.compFim).toBe('2026-07');
  });

  it('a busca local filtra as linhas e os totais recalculam sobre o visível', async () => {
    const linhas = [
      linha({ rns: 1, fantasia: 'ALFA', horasTotal: 10, horasRealizada: 10 }),
      linha({ rns: 2, fantasia: 'BETA', horasTotal: 5, horasRealizada: 5 }),
    ];
    const comp = await pronto({
      horasAplicadas: () => Promise.resolve(resultado({ linhas })),
    });
    expect(comp.totais().horasTotal).toBe(15);

    comp.store.busca.set('ALFA');
    expect(comp.linhas()).toHaveLength(1);
    expect(comp.totais().horasTotal).toBe(10);
  });

  it('calcula o % de postergada sobre o total visível', async () => {
    const linhas = [
      linha({ rns: 1, horasTotal: 10, horasPostergada: 2, horasRealizada: 8 }),
      linha({ rns: 2, horasTotal: 10, horasPostergada: 8, horasRealizada: 2 }),
    ];
    const comp = await pronto({
      horasAplicadas: () => Promise.resolve(resultado({ linhas })),
    });
    // total 20h, postergada 10h => 50%
    expect(comp.totais().percentualPostergada).toBe(50);
  });

  it('manda os filtros compartilhados (grupo/responsável/tipoSuporte) ao backend', async () => {
    const horasAplicadas = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ horasAplicadas });
    horasAplicadas.mockClear();

    comp.alternar(comp.store.responsavel, 'Kailan');
    await Promise.resolve();
    expect(horasAplicadas).toHaveBeenCalledWith(
      expect.objectContaining({ responsavel: ['Kailan'] }),
    );
  });

  it('mostra erro do backend sem quebrar', async () => {
    const comp = await pronto({
      horasAplicadas: () => Promise.resolve(resultado({ erro: 'ORA-00942', linhas: [] })),
    });
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.linhas()).toEqual([]);
  });
});
