import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { DashboardsService } from '../../core/services/dashboards.service';
import { DashboardDisponivel, ResultadoDashboard } from '../../core/models/dashboards.model';

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 6; i++) await fixture.whenStable();
}

function disponivel(over: Partial<DashboardDisponivel> = {}): DashboardDisponivel {
  return { id: 1, slug: 'previsao-inicio', nome: 'Previsão Início Oficial', mostrarGrafico: true, ...over };
}

function resultado(over: Partial<ResultadoDashboard> = {}): ResultadoDashboard {
  return {
    slug: 'previsao-inicio',
    nome: 'Previsão Início Oficial',
    periodo: { ref: '2026-07-01', direcao: 'avancar', n: 12, inicio: '2026-07-01', fimExclusivo: '2027-07-01', fim: '2027-06-30' },
    meses: [{ ano: 2026, mes: 7, nome: 'julho' }],
    atalhos: { 7: 2026 },
    mesSel: null,
    anoSel: null,
    situacoesDisponiveis: ['Confirmado', 'Provisório'],
    situacoesSelecionadas: ['Confirmado', 'Provisório'],
    linhasTabela: [{ CLIENTE: 'Cliente X', DATA: '2026-07-20' }],
    grafico: { labels: ['julho'], valores: [3] },
    totalPeriodo: 3,
    erro: null,
    ...over,
  };
}

describe('DashboardComponent', () => {
  function montar(service: Partial<DashboardsService>) {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardsService, useValue: { listar: () => Promise.resolve([disponivel()]), ...service } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ slug: 'previsao-inicio' }) } } },
      ],
    });
    return TestBed.createComponent(DashboardComponent);
  }

  it('carrega com os filtros padrão (avançar, 12 meses)', async () => {
    const rodar = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ rodar });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(rodar).toHaveBeenCalledWith('previsao-inicio', expect.objectContaining({ direcao: 'avancar', n: 12 }));
  });

  it('deriva as colunas da primeira linha da tabela', async () => {
    const fixture = montar({ rodar: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.colunas()).toEqual(['CLIENTE', 'DATA']);
  });

  it('mostra o erro do resultado (ex.: consulta não configurada) em vez da tabela', async () => {
    const fixture = montar({ rodar: () => Promise.resolve(resultado({ erro: 'Conexão externa não configurada.' })) });
    fixture.detectChanges();
    await assentar(fixture);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conexão externa não configurada.');
  });

  it('selecionarMes ativa o mês/ano e recarrega; limparFiltroMes limpa', async () => {
    const rodar = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ rodar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.selecionarMes(7, 2026);
    expect(comp.mesSel).toBe(7);
    expect(comp.anoSel).toBe(2026);
    await fixture.whenStable();
    expect(rodar).toHaveBeenLastCalledWith('previsao-inicio', expect.objectContaining({ mesSel: 7, anoSel: 2026 }));
    comp.limparFiltroMes();
    expect(comp.mesSel).toBeNull();
  });

  // ── Filtros no mesmo padrão das demais telas do BI: nasce fechado, botão alterna,
  // "Limpar" volta a situação para "todas" e tira o mês, sem mexer no período. ──────────
  it('o painel de filtros nasce fechado', async () => {
    const fixture = montar({ rodar: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await assentar(fixture);
    expect(fixture.componentInstance.filtrosAbertos()).toBe(false);
  });

  it('alternarFiltros abre e recolhe o painel', async () => {
    const fixture = montar({ rodar: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await assentar(fixture);
    const comp = fixture.componentInstance;
    comp.alternarFiltros();
    expect(comp.filtrosAbertos()).toBe(true);
    comp.alternarFiltros();
    expect(comp.filtrosAbertos()).toBe(false);
  });

  it('qtdFiltrosAtivos conta situações desmarcadas e o mês selecionado', async () => {
    // Mock DINÂMICO: como o backend real (DashboardsService.rodar), ecoa de volta só a
    // situação que foi enviada — o mock estático `resultado()` sempre devolve as duas, o que
    // mascararia a desmarcação assim que `carregar()` recarrega.
    const rodar = vi.fn((_slug: string, filtro: { situacao?: string[] }) =>
      Promise.resolve(
        resultado({
          situacoesSelecionadas: filtro.situacao ?? ['Confirmado', 'Provisório'],
        }),
      ),
    );
    const fixture = montar({ rodar });
    fixture.detectChanges();
    await assentar(fixture);
    const comp = fixture.componentInstance;
    expect(comp.qtdFiltrosAtivos()).toBe(0); // tudo marcado = sem filtro

    comp.alternarSituacao('Provisório', false);
    await fixture.whenStable();
    expect(comp.qtdFiltrosAtivos()).toBe(1);

    comp.selecionarMes(7, 2026);
    await fixture.whenStable();
    expect(comp.qtdFiltrosAtivos()).toBe(2);
  });

  it('limparFiltros volta a situação para "todas" e tira o mês, mas mantém o período', async () => {
    const rodar = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ rodar });
    fixture.detectChanges();
    await assentar(fixture);
    const comp = fixture.componentInstance;
    comp.n = 6;
    comp.selecionarMes(7, 2026);
    await fixture.whenStable();
    rodar.mockClear();

    comp.limparFiltros();
    await fixture.whenStable();
    expect(comp.mesSel).toBeNull();
    expect(comp.qtdFiltrosAtivos()).toBe(0);
    expect(comp.n).toBe(6); // período preservado
    expect(rodar).toHaveBeenCalledWith('previsao-inicio', expect.objectContaining({ situacao: undefined, mesSel: undefined }));
  });

  it('lista as abas de dashboards disponíveis', async () => {
    const fixture = montar({
      listar: () => Promise.resolve([disponivel(), disponivel({ id: 2, slug: 'outro', nome: 'Outro Dashboard' })]),
      rodar: () => Promise.resolve(resultado()),
    });
    fixture.detectChanges();
    await assentar(fixture);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Outro Dashboard');
  });
});
