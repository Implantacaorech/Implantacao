import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CapacidadeComponent } from './capacidade.component';
import { CoordenacaoService } from '../../core/services/coordenacao.service';
import { ResultadoCapacidade } from '../../core/models/capacidade.model';

function resultado(over: Partial<ResultadoCapacidade> = {}): ResultadoCapacidade {
  return {
    equipe: [
      {
        nome: 'Ana',
        perfil: 'Consultor',
        sicla: '007',
        clientes: 1,
        projetos: [{ cliente: 'Cliente X', golive: '2026-09-01' }],
        liberaEm: '2026-09-01',
        livresSemana: [10, 8, 6, 4, 2, 0],
        janela: '2026-07-20',
        notasModulos: { FAT: 8 },
        semNota: [],
        media: 8,
        temMatriz: true,
        score: 75,
        veredito: 'Pronto',
      },
    ],
    semanas: ['2026-07-13', '2026-07-20'],
    modulos: ['FAT'],
    turnosSemana: 10,
    ...over,
  };
}

describe('CapacidadeComponent', () => {
  function montar(service: Partial<CoordenacaoService>) {
    TestBed.configureTestingModule({
      imports: [CapacidadeComponent],
      providers: [provideRouter([]), { provide: CoordenacaoService, useValue: service }],
    });
    return TestBed.createComponent(CapacidadeComponent);
  }

  it('carrega a equipe com os filtros padrão (sem módulos, 6 semanas)', async () => {
    const capacidade = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ capacidade });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(capacidade).toHaveBeenCalledWith('', 6);
  });

  it('mostra o veredito e o score de cada linha', async () => {
    const fixture = montar({ capacidade: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana');
    expect(texto).toContain('Pronto');
    expect(texto).toContain('75');
  });

  it('reenvia a consulta com os filtros alterados', async () => {
    const capacidade = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ capacidade });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.modulos = 'FAT,CTB';
    comp.semanas = 4;
    await comp.carregar();
    expect(capacidade).toHaveBeenCalledWith('FAT,CTB', 4);
  });
});
