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
