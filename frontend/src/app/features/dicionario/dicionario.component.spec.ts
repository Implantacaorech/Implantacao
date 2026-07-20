import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DicionarioComponent } from './dicionario.component';
import { DicionarioService } from '../../core/services/dicionario.service';
import {
  FiltroSigla,
  RespostaDicionario,
  ResultadoPesquisaDicionario,
  StatusDicionario,
} from '../../core/models/dicionario.model';

function status(): StatusDicionario {
  return { totalDocumentos: 87, totalModulos: 21, totalAdicionais: 66, ultimaIngestaoEm: '2026-07-20T12:00:00Z' };
}
function siglas(): FiltroSigla[] {
  return [{ sigla: 'CTB', titulo: 'CTB - Contabilidade', tipo: 'modulo' }];
}
function resultado(): ResultadoPesquisaDicionario {
  return {
    slug: '01-ctb-contabilidade',
    tipo: 'modulo',
    sigla: 'CTB',
    titulo: 'CTB - Contabilidade',
    resumo: 'Centraliza a contabilidade.',
    trecho: 'configuracao CTB101',
    urlOrigem: 'https://github.com/x/modulos/01-ctb-contabilidade.md',
  };
}

describe('DicionarioComponent', () => {
  let fixtureAtual: ComponentFixture<DicionarioComponent> | null = null;

  afterEach(() => {
    fixtureAtual?.destroy();
    fixtureAtual = null;
  });

  function montar(service: Partial<DicionarioService>) {
    const base: Partial<DicionarioService> = {
      siglas: () => Promise.resolve(siglas()),
      status: () => Promise.resolve(status()),
      pesquisar: () => Promise.resolve([]),
      perguntar: () =>
        Promise.resolve({ resposta: '', fontes: [], temFundamento: false, iaDisponivel: false }),
      ...service,
    };
    TestBed.configureTestingModule({
      imports: [DicionarioComponent],
      providers: [provideRouter([]), { provide: DicionarioService, useValue: base }],
    });
    fixtureAtual = TestBed.createComponent(DicionarioComponent);
    fixtureAtual.detectChanges();
    return fixtureAtual;
  }

  async function esperarTexto(fixture: ComponentFixture<DicionarioComponent>, trecho: string) {
    const limite = Date.now() + 2000;
    while (Date.now() < limite) {
      fixture.detectChanges();
      if ((fixture.nativeElement.textContent as string).includes(trecho)) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    fixture.detectChanges();
    throw new Error(`Texto "${trecho}" não apareceu. Atual: ${fixture.nativeElement.textContent}`);
  }

  it('mostra o resumo da base (87 documentos)', async () => {
    const fixture = montar({});
    await esperarTexto(fixture, '87');
    expect(fixture.nativeElement.textContent).toContain('módulos');
  });

  it('busca por termo e lista o resultado com trecho', async () => {
    const fixture = montar({ pesquisar: () => Promise.resolve([resultado()]) });
    fixture.componentInstance.termo.set('CTB101');
    await fixture.componentInstance.buscar();
    await esperarTexto(fixture, 'configuracao CTB101'); // trecho do card, não o texto do dropdown
    expect(fixture.componentInstance.resultados()).toHaveLength(1);
  });

  it('não busca com todos os filtros vazios', async () => {
    let chamadas = 0;
    const fixture = montar({
      pesquisar: () => {
        chamadas += 1;
        return Promise.resolve([resultado()]);
      },
    });
    fixture.componentInstance.onTermoAlterado('   ');
    await new Promise((r) => setTimeout(r, 500));
    expect(chamadas).toBe(0);
  });

  it('perguntar sem IA mostra aviso e fontes', async () => {
    const resp: RespostaDicionario = {
      resposta: 'Documentos relacionados encontrados.',
      fontes: [{ indice: 1, slug: '01-ctb-contabilidade', titulo: 'CTB - Contabilidade', urlOrigem: 'x' }],
      temFundamento: true,
      iaDisponivel: false,
    };
    const fixture = montar({ perguntar: () => Promise.resolve(resp) });
    fixture.componentInstance.trocarAba('perguntar');
    fixture.componentInstance.pergunta.set('como configuro comissão');
    await fixture.componentInstance.perguntar();
    await esperarTexto(fixture, 'Fontes consultadas');
    expect(fixture.nativeElement.textContent).toContain('não está configurada');
  });

  it('mostra erro quando a busca falha', async () => {
    const fixture = montar({ pesquisar: () => Promise.reject(new Error('x')) });
    fixture.componentInstance.onTermoAlterado('CTB');
    await esperarTexto(fixture, 'Não foi possível pesquisar agora.');
  });
});
