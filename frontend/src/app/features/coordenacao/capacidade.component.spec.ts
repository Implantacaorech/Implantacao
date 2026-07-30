import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
    setor: '',
    setoresDisponiveis: ['GRM-Implantação', 'GRM-Suporte'],
    semSetor: 0,
    ...over,
  };
}

describe('CapacidadeComponent', () => {
  function montar(service: Partial<CoordenacaoService>) {
    TestBed.configureTestingModule({
      imports: [CapacidadeComponent],
      providers: [
        provideRouter([]),
        // O PreferenciasService (filtros salvos por usuário) fala HTTP. Sem sessão no
        // localStorage ele nem chama o servidor, então não há requisição a despachar aqui.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CoordenacaoService, useValue: service },
      ],
    });
    return TestBed.createComponent(CapacidadeComponent);
  }

  it('carrega a equipe com os filtros padrão (sem módulos, 6 semanas, todos os setores)', async () => {
    const capacidade = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ capacidade });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(capacidade).toHaveBeenCalledWith('', 6, '');
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
    comp.modulos.set('FAT,CTB');
    comp.semanas.set(4);
    await comp.carregar();
    expect(capacidade).toHaveBeenCalledWith('FAT,CTB', 4, '');
  });

  it('trocar o setor filtra na hora, sem esperar o "Avaliar"', async () => {
    const capacidade = vi.fn().mockResolvedValue(resultado());
    const fixture = montar({ capacidade });
    fixture.detectChanges();
    await fixture.whenStable();
    capacidade.mockClear();

    fixture.componentInstance.trocarSetor('GRM-Suporte');
    await fixture.whenStable();

    expect(capacidade).toHaveBeenCalledWith('', 6, 'GRM-Suporte');
  });

  it('oferece os setores da equipe no select, e "(sem setor)" só quando há quem esteja sem', async () => {
    const fixture = montar({
      capacidade: () => Promise.resolve(resultado({ semSetor: 2 })),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const opcoes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>(
        'select[name="setor"] option',
      ),
    ].map((o) => o.textContent?.trim());
    expect(opcoes).toEqual([
      'Todos os setores',
      'GRM-Implantação',
      'GRM-Suporte',
      '(sem setor)',
    ]);
  });

  it('sem "(sem setor)" quando toda a equipe tem setor', async () => {
    const fixture = montar({ capacidade: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).not.toContain('(sem setor)');
  });

  it('setor sem ninguém explica o vazio em vez de dizer que a equipe não está cadastrada', async () => {
    const fixture = montar({
      capacidade: () => Promise.resolve(resultado({ equipe: [], setor: 'GRM-Suporte' })),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.setor.set('GRM-Suporte');
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Nenhum Consultor/GCI ativo no setor');
    expect(texto).not.toContain('cadastre a equipe');
  });

  it('o filtro de módulos reage à digitação (era `computed` sobre campo comum, ficava preso)', async () => {
    const fixture = montar({ capacidade: () => Promise.resolve(resultado()) });
    fixture.detectChanges();
    await fixture.whenStable();
    const comp = fixture.componentInstance;

    expect(comp.filtro()).toBe('');
    comp.modulos.set('  FAT, CTB  ');
    expect(comp.filtro()).toBe('FAT, CTB');
  });
});
