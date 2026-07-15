import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AtividadeComponent } from './atividade.component';
import { AtividadeService } from '../../core/services/atividade.service';
import { PainelAtividade } from '../../core/models/atividade.model';

function painel(over: Partial<PainelAtividade> = {}): PainelAtividade {
  return {
    feed: [],
    uso: { dias: 30, projetosNovos: 2, documentos: 5, emails: 3, notas: 1, transicoes: 4, totalEventos: 15 },
    funil: [{ fase: 'Agendamento', n: 2, idadeMedia: 3 }],
    ...over,
  };
}

describe('AtividadeComponent', () => {
  function montar(service: Partial<AtividadeService>) {
    TestBed.configureTestingModule({
      imports: [AtividadeComponent],
      providers: [provideRouter([]), { provide: AtividadeService, useValue: service }],
    });
    return TestBed.createComponent(AtividadeComponent);
  }

  it('mostra os KPIs de uso vindos da API', async () => {
    const fixture = montar({ atividade: () => Promise.resolve(painel()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('15');
  });

  it('mostra mensagem de erro quando a chamada falha', async () => {
    const fixture = montar({ atividade: () => Promise.reject(new Error('falhou')) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar a Atividade da operação.');
  });

  it('lista o feed de eventos com cliente e descrição', async () => {
    const dados = painel({
      feed: [{ id: 1, projetoId: 9, tipo: 'nota', descricao: 'Ajuste no cronograma', autor: 'Ana', criadoEm: new Date().toISOString(), cliente: 'Cliente X' }],
    });
    const fixture = montar({ atividade: () => Promise.resolve(dados) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cliente X');
    expect(texto).toContain('Ajuste no cronograma');
  });
});
