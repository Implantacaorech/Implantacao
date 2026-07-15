import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatrizFichaComponent } from './matriz-ficha.component';
import { MatrizService } from '../../core/services/matriz.service';
import { MatrizFichaView } from '../../core/models/matriz.model';

function view(over: Partial<MatrizFichaView> = {}): MatrizFichaView {
  return {
    tecnico: { id: 9, nome: 'Ana', setor: 'FAT', dias: '5', notas: '{}', atualizadoEm: null, atualizadoPor: '' },
    areas: [['Faturamento', [{ id: 1, sigla: 'FAT-01', area: 'Faturamento', ordem: 0 }]]],
    notas: {},
    editavel: true,
    volta: true,
    ...over,
  };
}

describe('MatrizFichaComponent', () => {
  function montar(service: Partial<MatrizService>) {
    TestBed.configureTestingModule({
      imports: [MatrizFichaComponent],
      providers: [
        provideRouter([]),
        { provide: MatrizService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '9' }) } } },
      ],
    });
    return TestBed.createComponent(MatrizFichaComponent);
  }

  it('pré-preenche setor/dias/notas a partir da ficha', async () => {
    const fixture = montar({ ficha: () => Promise.resolve(view({ notas: { 'FAT-01': 7 } })) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    expect(comp.setor()).toBe('FAT');
    expect(comp.dias()).toBe('5');
    expect(comp.nota('FAT-01')).toBe('7');
  });

  it('não mostra o botão salvar quando a ficha não é editável', async () => {
    const fixture = montar({ ficha: () => Promise.resolve(view({ editavel: false })) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Salvar ficha');
  });

  it('não mostra o link de voltar quando volta é false', async () => {
    const fixture = montar({ ficha: () => Promise.resolve(view({ volta: false })) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Voltar à Matriz');
  });

  it('salva setor/dias/notas editados', async () => {
    const salvar = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ ficha: () => Promise.resolve(view()), salvar });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.setor.set('CTB');
    comp.atualizarNota('FAT-01', '8');
    await comp.salvar();
    expect(salvar).toHaveBeenCalledWith(9, { setor: 'CTB', dias: '5', notas: { 'FAT-01': '8' } });
    expect(comp.aviso()).toBe('Ficha salva.');
  });
});
