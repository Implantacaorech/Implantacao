import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiMovimentosComponent } from './bi-movimentos.component';
import { BiMovimentosService } from '../../core/services/bi-movimentos.service';
import {
  ContagemMovimentoBi,
  ResultadoMovimentosBi,
} from '../../core/models/bi-movimentos.model';

function tecnico(over: Partial<ContagemMovimentoBi> = {}): ContagemMovimentoBi {
  return {
    chave: 'THOMAZ',
    quantidade: 22,
    horasTotal: 52.8,
    horasCobradas: 52.8,
    horasNaoCobradas: 0,
    percentualCobradas: 100,
    ...over,
  };
}

function tpMovimento(over: Partial<ContagemMovimentoBi> = {}): ContagemMovimentoBi {
  return {
    chave: 'VISITAS',
    quantidade: 22,
    horasTotal: 52.8,
    horasCobradas: 52.8,
    horasNaoCobradas: 0,
    percentualCobradas: 100,
    ...over,
  };
}

function resultado(over: Partial<ResultadoMovimentosBi> = {}): ResultadoMovimentosBi {
  return {
    periodo: { inicio: '2026-04-29', fim: '2026-07-29' },
    periodoLimitado: false,
    porTecnico: [tecnico()],
    porTpMovimento: [tpMovimento()],
    totais: {
      quantidade: 22, tecnicos: 1, horasTotal: 52.8, horasCobradas: 52.8,
      horasNaoCobradas: 0, percentualCobradas: 100,
    },
    filtros: { tecnicos: ['THOMAZ'], tiposMovimento: ['VISITAS'] },
    selecionados: { tecnicos: [], tiposMovimento: [] },
    erro: null,
    ...over,
  };
}

describe('BiMovimentosComponent', () => {
  function montar(service: Partial<BiMovimentosService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiMovimentosComponent],
      providers: [provideRouter([]), { provide: BiMovimentosService, useValue: service }],
    });
    return TestBed.createComponent(BiMovimentosComponent);
  }

  async function pronto(service: Partial<BiMovimentosService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega e grava o período devolvido pelo backend', async () => {
    const comp = await pronto({ movimentos: () => Promise.resolve(resultado()) });
    expect(comp.porTecnico()).toHaveLength(1);
    expect(comp.dataIni).toBe('2026-04-29');
    expect(comp.dataFim).toBe('2026-07-29');
  });

  it('a busca local filtra por nome de técnico e recalcula os totais', async () => {
    const porTecnico = [
      tecnico({ chave: 'ALAN', horasTotal: 10, horasCobradas: 10 }),
      tecnico({ chave: 'ANA', horasTotal: 5, horasCobradas: 0, horasNaoCobradas: 5, percentualCobradas: 0 }),
    ];
    const comp = await pronto({
      movimentos: () => Promise.resolve(resultado({ porTecnico })),
    });
    expect(comp.totais().horasTotal).toBe(15);

    comp.store.busca.set('ana');
    expect(comp.porTecnico()).toHaveLength(1);
    expect(comp.totais().horasTotal).toBe(5);
    expect(comp.totais().horasCobradas).toBe(0);
  });

  it('a busca não afeta a quebra por tipo de movimento (dimensão diferente)', async () => {
    const comp = await pronto({ movimentos: () => Promise.resolve(resultado()) });
    comp.store.busca.set('nome que não bate com nada');
    expect(comp.porTpMovimento()).toHaveLength(1);
  });

  it('manda os filtros locais (técnico/tipo de movimento/cobra hora) ao backend', async () => {
    const movimentos = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ movimentos });
    movimentos.mockClear();

    comp.alternar(comp.tecnicoSel, 'THOMAZ');
    await Promise.resolve();
    expect(movimentos).toHaveBeenCalledWith(expect.objectContaining({ tecnico: ['THOMAZ'] }));
  });

  it('limpar zera os três filtros locais e a busca', async () => {
    const comp = await pronto({ movimentos: () => Promise.resolve(resultado()) });
    comp.tecnicoSel.set(['THOMAZ']);
    comp.tpMovimentoSel.set(['VISITAS']);
    comp.cobraHoraSel.set(['Sim']);
    comp.store.busca.set('algo');

    await comp.limparFiltros();

    expect(comp.tecnicoSel()).toEqual([]);
    expect(comp.tpMovimentoSel()).toEqual([]);
    expect(comp.cobraHoraSel()).toEqual([]);
    expect(comp.store.busca()).toBe('');
  });

  it('mostra o aviso quando o período foi recortado pelo teto de 6 meses', async () => {
    const fixture = montar({
      movimentos: () => Promise.resolve(resultado({ periodoLimitado: true })),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('teto de 6 meses');
  });

  it('mostra erro do backend sem quebrar', async () => {
    const comp = await pronto({
      movimentos: () => Promise.resolve(resultado({ erro: 'ORA-00942', porTecnico: [] })),
    });
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.porTecnico()).toEqual([]);
  });
});
