import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatrizDetalhadaComponent } from './matriz-detalhada.component';

const BASE = `${environment.apiUrl}/matriz-detalhada`;

function envelope<T>(data: T) {
  return { success: true, message: 'ok', timestamp: '', data };
}

/** Ficha de um técnico: um módulo e um adicional, com médias distintas por técnico. */
function ficha(nome: string, mediaFat: number, mediaCnv: number) {
  return envelope({
    tecnico: { id: 1, nome, setor: 'FAT', dias: '5' },
    modulos: [
      {
        sigla: 'CNV',
        tipo: 'adicional',
        titulo: 'CNV',
        total: 2,
        avaliadas: 2,
        media: mediaCnv,
        menus: [],
      },
      {
        sigla: 'FAT',
        tipo: 'modulo',
        titulo: 'FAT - Faturamento',
        total: 4,
        avaliadas: 3,
        media: mediaFat,
        menus: [],
      },
    ],
    resumo: { media: 7, avaliadas: 5, total: 6 },
    editavel: false,
    volta: true,
  });
}

describe('MatrizDetalhadaComponent — gráfico "Média por módulo"', () => {
  let httpMock: HttpTestingController;

  function montar() {
    TestBed.configureTestingModule({
      imports: [MatrizDetalhadaComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(MatrizDetalhadaComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    return fixture;
  }

  async function abrirFichaDe(
    fixture: ReturnType<typeof montar>,
    nome: string,
    mediaFat: number,
    mediaCnv: number,
  ) {
    httpMock.expectOne(`${BASE}/1`).flush(ficha(nome, mediaFat, mediaCnv));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('usa as médias do TÉCNICO SELECIONADO, sem consultar a média geral', async () => {
    const fixture = montar();
    httpMock.expectOne(BASE).flush(
      envelope({
        tecnicos: [
          { id: 1, nome: 'Ana', setor: 'FAT' },
          { id: 2, nome: 'Beto', setor: 'FAT' },
        ],
        meuId: 1,
        podeVerTodos: true,
        podeAdmin: false,
      }),
    );
    await fixture.whenStable();
    await abrirFichaDe(fixture, 'Ana', 9, 4);

    const comp = fixture.componentInstance;
    comp.abrirGrafico();
    fixture.detectChanges();

    // Nenhuma chamada a /medias-gerais — o gráfico sai da ficha já carregada.
    httpMock.expectNone(`${BASE}/medias-gerais`);

    const cfg = comp.graficoConfig()!;
    expect(cfg.data.datasets[0].label).toBe('Média do técnico');
    // Módulos primeiro, adicionais depois — e os valores são os da Ana.
    expect(cfg.data.labels).toEqual(['FAT', 'CNV ·adic']);
    expect(cfg.data.datasets[0].data).toEqual([9, 4]);
  });

  it('acompanha a troca de técnico', async () => {
    const fixture = montar();
    httpMock.expectOne(BASE).flush(
      envelope({
        tecnicos: [
          { id: 1, nome: 'Ana', setor: 'FAT' },
          { id: 2, nome: 'Beto', setor: 'FAT' },
        ],
        meuId: 1,
        podeVerTodos: true,
        podeAdmin: false,
      }),
    );
    await fixture.whenStable();
    await abrirFichaDe(fixture, 'Ana', 9, 4);

    const comp = fixture.componentInstance;
    expect(comp.graficoConfig()!.data.datasets[0].data).toEqual([9, 4]);

    void comp.trocarTecnico(2);
    httpMock.expectOne(`${BASE}/2`).flush(ficha('Beto', 3, 6));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.graficoConfig()!.data.datasets[0].data).toEqual([3, 6]);
  });

  it('sem nenhuma média avaliada, não monta o gráfico', async () => {
    const fixture = montar();
    httpMock.expectOne(BASE).flush(
      envelope({
        tecnicos: [{ id: 1, nome: 'Ana', setor: 'FAT' }],
        meuId: 1,
        podeVerTodos: false,
        podeAdmin: false,
      }),
    );
    await fixture.whenStable();
    httpMock.expectOne(`${BASE}/1`).flush(
      envelope({
        tecnico: { id: 1, nome: 'Ana', setor: 'FAT', dias: '' },
        modulos: [
          {
            sigla: 'FAT',
            tipo: 'modulo',
            titulo: 'FAT',
            total: 4,
            avaliadas: 0,
            media: null,
            menus: [],
          },
        ],
        resumo: { media: null, avaliadas: 0, total: 4 },
        editavel: false,
        volta: false,
      }),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.graficoConfig()).toBeNull();
  });
});
