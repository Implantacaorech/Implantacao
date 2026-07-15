import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CronogramaPlanoComponent } from './cronograma-plano.component';
import { PlanoCronogramaService } from '../../core/services/plano-cronograma.service';
import { CronogramaItem, Modificacao } from '../../core/models/plano-cronograma.model';

function item(over: Partial<CronogramaItem> = {}): CronogramaItem {
  return {
    id: 1,
    projetoId: 5,
    ordem: 0,
    etapa: 'Abertura',
    topicos: 'Parametrização',
    horas: '4',
    data: '10/08/2026',
    modalidade: 'Remoto',
    status: 'Previsto',
    ...over,
  };
}

describe('CronogramaPlanoComponent', () => {
  function montar(service: Partial<PlanoCronogramaService>) {
    TestBed.configureTestingModule({
      imports: [CronogramaPlanoComponent],
      providers: [
        provideRouter([]),
        { provide: PlanoCronogramaService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(CronogramaPlanoComponent);
  }

  it('carrega as linhas e o histórico do backend', async () => {
    const historico: Modificacao[] = [
      { id: 1, projetoId: 5, entidade: 'cronograma', ref: 'linha 1', campo: 'status', de: 'Previsto', para: 'Agendado', autor: 'Ana', criadoEm: new Date().toISOString() },
    ];
    const fixture = montar({ obterCronograma: () => Promise.resolve({ itens: [item()], historico }) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.linhas().length).toBe(1);
    expect(comp.linhas()[0].etapa).toBe('Abertura');
    expect(comp.historico()).toEqual(historico);
  });

  it('adicionar/remover linha altera a lista local', async () => {
    const fixture = montar({ obterCronograma: () => Promise.resolve({ itens: [], historico: [] }) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.adicionarLinha();
    expect(comp.linhas().length).toBe(1);
    comp.removerLinha(0);
    expect(comp.linhas().length).toBe(0);
  });

  it('mover linha troca a posição', async () => {
    const fixture = montar({
      obterCronograma: () => Promise.resolve({ itens: [item({ id: 1, etapa: 'A' }), item({ id: 2, etapa: 'B' })], historico: [] }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.moverLinha(0, 1);
    expect(comp.linhas().map((l) => l.etapa)).toEqual(['B', 'A']);
  });

  it('salvar envia as linhas atuais e recarrega', async () => {
    const salvarCronograma = vi.fn().mockResolvedValue({ itens: [item()], mudancas: 2 });
    const obterCronograma = vi.fn().mockResolvedValue({ itens: [item()], historico: [] });
    const fixture = montar({ obterCronograma, salvarCronograma });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.salvar();
    expect(salvarCronograma).toHaveBeenCalledWith(5, comp.linhas());
    expect(comp.aviso()).toContain('2 alteração');
    expect(obterCronograma).toHaveBeenCalledTimes(2);
  });
});
