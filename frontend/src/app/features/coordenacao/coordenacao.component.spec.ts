import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CoordenacaoComponent } from './coordenacao.component';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { PainelCoordenacao } from '../../core/models/coordenacao.model';

function painel(over: Partial<PainelCoordenacao> = {}): PainelCoordenacao {
  return {
    m: {
      total: 10,
      ativos: 7,
      concluidos: 3,
      porSituacao: { 'Em andamento': 6, 'Em risco': 1, Pausado: 0, Concluído: 3 },
      porEtapa: { Agendamento: 2, Levantamento: 1, Projeto: 1, Designação: 1, 'Cronograma e Check-list': 1, Encerramento: 1 },
      atrasados: [],
      nAtrasados: 0,
      emRisco: [],
      nRisco: 0,
      gatePendente: 2,
      noPrazo: 5,
      consultores: [],
      horasCob: 100,
      horasBon: 10,
      horasTotal: 110,
      ttvMedio: 30,
    },
    alertas: [],
    etapas: ['Agendamento', 'Levantamento', 'Projeto', 'Designação', 'Cronograma e Check-list', 'Encerramento'],
    situacoes: ['Em andamento', 'Em risco', 'Pausado', 'Concluído'],
    ...over,
  };
}

describe('CoordenacaoComponent', () => {
  function montar(service: Partial<CoordenacaoService>) {
    TestBed.configureTestingModule({
      imports: [CoordenacaoComponent],
      providers: [provideRouter([]), { provide: CoordenacaoService, useValue: service }],
    });
    return TestBed.createComponent(CoordenacaoComponent);
  }

  it('mostra os KPIs vindos da API', async () => {
    const fixture = montar({ coordenacao: () => Promise.resolve(painel()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('10');
    expect(texto).toContain('110');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ coordenacao: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar o Painel de Coordenação.');
  });

  it('enviar resumo mostra o aviso de sucesso retornado pelo backend', async () => {
    const enviarDigest = vi.fn().mockResolvedValue({ ok: true, mensagem: 'Digest enviado.' });
    const fixture = montar({ coordenacao: () => Promise.resolve(painel()), enviarDigest });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.enviarDigest();
    expect(fixture.componentInstance.aviso()).toBe('Digest enviado.');
  });

  it('lista os atrasados com link para o projeto', async () => {
    const dados = painel();
    dados.m.atrasados = [{ id: 5, cliente: 'Cliente X', etapa: 'Projeto', consultor: 'Ana', dias: 12 }];
    dados.m.nAtrasados = 1;
    const fixture = montar({ coordenacao: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cliente X');
  });
});
