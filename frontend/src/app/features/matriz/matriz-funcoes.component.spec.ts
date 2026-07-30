import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MatrizFuncoesComponent } from './matriz-funcoes.component';

const BASE = `${environment.apiUrl}/matriz-funcoes`;

function envelope<T>(data: T) {
  return { success: true, message: 'ok', timestamp: '', data };
}

function funcao(codigo: string, sigla: string, nota: number | null) {
  return {
    codigo,
    descricao: `Função ${codigo}`,
    menus: `${sigla}94A`,
    chave: `${sigla}|${codigo}`,
    nota,
  };
}

/** Ficha: dois módulos + o grupo de triagem "Classificar". */
function ficha(editavel = true) {
  return envelope({
    tecnico: { id: 1, nome: 'Ana', setor: 'GRM-Implantação', dias: '5' },
    modulos: [
      {
        sigla: 'CTB',
        titulo: 'CTB',
        total: 2,
        avaliadas: 1,
        media: 8,
        funcoes: [funcao('3004', 'CTB', 8), funcao('2001', 'CTB', null)],
      },
      {
        sigla: 'FAT',
        titulo: 'FAT',
        total: 1,
        avaliadas: 0,
        media: null,
        funcoes: [funcao('3004', 'FAT', null)],
      },
      {
        sigla: 'Classificar',
        titulo: 'Sem módulo identificado',
        total: 1,
        avaliadas: 0,
        media: null,
        funcoes: [
          { codigo: '9', descricao: 'Rech DF-e', menus: '', chave: 'Classificar|9', nota: null },
        ],
      },
    ],
    resumo: { media: 8, avaliadas: 1, total: 4 },
    editavel,
    volta: true,
  });
}

describe('MatrizFuncoesComponent', () => {
  let httpMock: HttpTestingController;

  /** Monta o componente e resolve as DUAS chamadas do boot: a lista de técnicos e, na
   * sequência, a ficha do técnico selecionado. O `whenStable` entre elas é obrigatório —
   * `carregarFicha` só é disparada depois que a promise da lista resolve. */
  async function montar(podeAdmin = true, resposta = ficha()) {
    TestBed.configureTestingModule({
      imports: [MatrizFuncoesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(MatrizFuncoesComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(BASE).flush(
      envelope({
        tecnicos: [{ id: 1, nome: 'Ana', setor: 'GRM-Implantação' }],
        meuId: 1,
        podeVerTodos: true,
        podeAdmin,
      }),
    );
    await fixture.whenStable();
    httpMock.expectOne(`${BASE}/1`).flush(resposta);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('carrega a ficha do próprio técnico e mostra os módulos', async () => {
    const fixture = await montar();
    const comp = fixture.componentInstance;
    expect(comp.modulos().map((m) => m.sigla)).toEqual(['CTB', 'FAT', 'Classificar']);
    expect(fixture.nativeElement.textContent).toContain('CTB');
  });

  it('a mesma função em dois módulos tem nota independente', async () => {
    const comp = (await montar()).componentInstance;
    const ctb = comp.modulos().find((m) => m.sigla === 'CTB')!;
    const fat = comp.modulos().find((m) => m.sigla === 'FAT')!;
    expect(ctb.funcoes[0].chave).toBe('CTB|3004');
    expect(fat.funcoes[0].chave).toBe('FAT|3004');
    expect(ctb.funcoes[0].nota).toBe(8);
    expect(fat.funcoes[0].nota).toBeNull();
  });

  it('editar recalcula a média do módulo e o resumo na hora', async () => {
    const comp = (await montar()).componentInstance;
    const ctb = comp.modulos().find((m) => m.sigla === 'CTB')!;
    comp.editar(ctb, ctb.funcoes[1], '6'); // CTB passa a ter 8 e 6
    expect(ctb.media).toBe(7);
    expect(ctb.avaliadas).toBe(2);
    expect(comp.temAlteracao()).toBe(true);
  });

  it('nota fora da faixa é limitada a 0-10', async () => {
    const comp = (await montar()).componentInstance;
    const ctb = comp.modulos().find((m) => m.sigla === 'CTB')!;
    comp.editar(ctb, ctb.funcoes[0], '99');
    expect(ctb.funcoes[0].nota).toBe(10);
    comp.editar(ctb, ctb.funcoes[0], '-5');
    expect(ctb.funcoes[0].nota).toBe(0);
  });

  it('somente consulta não deixa editar', async () => {
    const comp = (await montar(true, ficha(false))).componentInstance;
    const ctb = comp.modulos().find((m) => m.sigla === 'CTB')!;
    comp.editar(ctb, ctb.funcoes[1], '6');
    expect(ctb.funcoes[1].nota).toBeNull();
    expect(comp.temAlteracao()).toBe(false);
  });

  it('salvar manda só as notas alteradas', async () => {
    const comp = (await montar()).componentInstance;
    const ctb = comp.modulos().find((m) => m.sigla === 'CTB')!;
    comp.editar(ctb, ctb.funcoes[1], '6');
    const p = comp.salvar();
    const req = httpMock.expectOne(`${BASE}/1/salvar`);
    expect(req.request.body).toEqual({ notas: { 'CTB|2001': '6' } });
    req.flush(envelope({ salvo: true }));
    await p;
    expect(comp.salvo()).toBe(true);
    expect(comp.temAlteracao()).toBe(false);
  });

  it('filtra os módulos pela sigla', async () => {
    const comp = (await montar()).componentInstance;
    comp.filtro.set('ctb');
    expect(comp.modulosFiltrados().map((m) => m.sigla)).toEqual(['CTB']);
    comp.filtro.set('zzz');
    expect(comp.semResultado()).toBe(true);
  });

  it('o gráfico só inclui módulos com média', async () => {
    const cfg = (await montar()).componentInstance.graficoConfig()!;
    expect(cfg.data.labels).toEqual(['CTB']); // FAT e Classificar estão sem média
  });

  it('"Reler do SICLA" limpa o cache no servidor e recarrega a ficha', async () => {
    const comp = (await montar(true)).componentInstance;
    const p = comp.recarregarDoSicla();
    httpMock
      .expectOne(`${BASE}/recarregar`)
      .flush(envelope({ modulos: 76, funcoes: 1977 }));
    await Promise.resolve();
    httpMock.expectOne(`${BASE}/1`).flush(ficha());
    await p;
    expect(comp.erro()).toBeNull();
  });

  it('SICLA fora: mostra a mensagem do servidor, não um erro genérico', async () => {
    TestBed.configureTestingModule({
      imports: [MatrizFuncoesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(MatrizFuncoesComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(BASE).flush(
      envelope({
        tecnicos: [{ id: 1, nome: 'Ana', setor: '' }],
        meuId: 1,
        podeVerTodos: true,
        podeAdmin: false,
      }),
    );
    await fixture.whenStable();
    httpMock
      .expectOne(`${BASE}/1`)
      .flush(
        { message: 'Não foi possível ler as funções no SICLA: ORA-12541' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.erro()).toContain('ORA-12541');
  });
});
