import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';
import { PainelService } from '../../core/services/painel.service';
import { PainelHome } from '../../core/models/painel.model';

function painelVazio(): PainelHome {
  return {
    dados: { ativos: 0, noPrazo: 0, atrasados: 0, alertas: 0, risco: 0, total: 0, concluidos: 0, gatePendente: 0 },
    alertas: [],
    pendencias: [],
    foco: null,
  };
}

describe('HomeComponent', () => {
  function montar(painelService: Partial<PainelService>) {
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), { provide: PainelService, useValue: painelService }],
    });
    const fixture = TestBed.createComponent(HomeComponent);
    return fixture;
  }

  it('mostra "Carregando…" enquanto a chamada está pendente', () => {
    const fixture = montar({ home: () => new Promise(() => {}) });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Carregando');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ home: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o painel.');
  });

  it('renderiza os KPIs vindos da API', async () => {
    const dados = painelVazio();
    dados.dados.ativos = 5;
    dados.dados.atrasados = 2;
    const fixture = montar({ home: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('5');
    expect(texto).toContain('2');
    expect(texto).not.toContain('Carregando');
  });

  it('sem foco, não renderiza a seção "Em foco"', async () => {
    const fixture = montar({ home: () => Promise.resolve(painelVazio()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.foco')).toBeNull();
  });

  it('lista as pendências com o rótulo da ação', async () => {
    const dados = painelVazio();
    dados.pendencias = [
      { id: 7, cliente: 'Cliente X', fase: 'Agendamento', atraso: null, acao: 'Definir GCI Responsável', tipo: 'acao:definir_gci' },
    ];
    const fixture = montar({ home: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cliente X');
    expect(texto).toContain('Definir GCI Responsável');
  });

  it('resolve a rota da pendência para a tela de Designação correta', () => {
    const fixture = montar({ home: () => Promise.resolve(painelVazio()) });
    const comp = fixture.componentInstance;
    expect(comp.rotaAcao({ id: 3, cliente: '', fase: '', atraso: null, acao: '', tipo: 'acao:definir_gci' })).toEqual([
      '/projetos',
      3,
      'designacao',
      'definir-gci',
    ]);
    expect(comp.rotaAcao({ id: 3, cliente: '', fase: '', atraso: null, acao: '', tipo: 'algo-desconhecido' })).toEqual([
      '/projetos',
      3,
    ]);
  });
});
