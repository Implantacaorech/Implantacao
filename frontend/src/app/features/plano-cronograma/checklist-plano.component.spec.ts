import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ChecklistPlanoComponent } from './checklist-plano.component';
import { PlanoCronogramaService } from '../../core/services/plano-cronograma.service';
import { ChecklistItem } from '../../core/models/plano-cronograma.model';

function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 1,
    projetoId: 5,
    ordem: 0,
    modulo: 'FAT',
    item: 'Cadastro de produtos',
    responsavel: 'Ana',
    status: 'Pendente',
    obs: '',
    ...over,
  };
}

describe('ChecklistPlanoComponent', () => {
  function montar(service: Partial<PlanoCronogramaService>) {
    TestBed.configureTestingModule({
      imports: [ChecklistPlanoComponent],
      providers: [
        provideRouter([]),
        { provide: PlanoCronogramaService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
      ],
    });
    return TestBed.createComponent(ChecklistPlanoComponent);
  }

  it('carrega as linhas do backend, sem os campos internos (id/projetoId/ordem)', async () => {
    const fixture = montar({ obterChecklist: () => Promise.resolve({ itens: [item()], historico: [] }) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.linhas()).toEqual([{ modulo: 'FAT', item: 'Cadastro de produtos', responsavel: 'Ana', status: 'Pendente', obs: '' }]);
  });

  it('atualizarCampo altera só a linha indicada', async () => {
    const fixture = montar({ obterChecklist: () => Promise.resolve({ itens: [item(), item({ id: 2, modulo: 'CTB' })], historico: [] }) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.atualizarCampo(1, 'responsavel', 'Beto');
    expect(comp.linhas()[0].responsavel).toBe('Ana');
    expect(comp.linhas()[1].responsavel).toBe('Beto');
  });

  it('seed pede confirmação e, se aceito, recarrega o roteiro dos módulos', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const seedChecklist = vi.fn().mockResolvedValue({ itens: [item()], mudancas: 3 });
    const obterChecklist = vi.fn().mockResolvedValue({ itens: [item()], historico: [] });
    const fixture = montar({ obterChecklist, seedChecklist });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    await comp.carregarRoteiro();
    expect(confirmSpy).toHaveBeenCalled();
    expect(seedChecklist).toHaveBeenCalledWith(5);
    expect(comp.aviso()).toContain('3 alteração');
    confirmSpy.mockRestore();
  });

  it('seed cancelado não chama o backend', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const seedChecklist = vi.fn();
    const fixture = montar({ obterChecklist: () => Promise.resolve({ itens: [], historico: [] }), seedChecklist });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.carregarRoteiro();
    expect(seedChecklist).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
