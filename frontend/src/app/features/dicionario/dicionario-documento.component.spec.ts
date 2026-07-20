import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DicionarioDocumentoComponent } from './dicionario-documento.component';
import { DicionarioService } from '../../core/services/dicionario.service';
import { DocumentoDetalhe } from '../../core/models/dicionario.model';

function detalhe(): DocumentoDetalhe {
  return {
    slug: '01-ctb-contabilidade',
    tipo: 'modulo',
    sigla: 'CTB',
    titulo: 'CTB - Contabilidade',
    resumo: 'Centraliza a contabilidade do SIGER.',
    conteudo: '# CTB',
    secoes: [
      {
        titulo: '8. Configuracoes',
        corpo: 'A configuracao CTB101 define parametros.',
        categoria: 'configuracao',
        blocos: [
          {
            tipo: 'paragrafo',
            segmentos: [
              { texto: 'A configuracao ' },
              { texto: 'CTB101', codigo: true },
              { texto: ' define parametros.' },
            ],
          },
          {
            tipo: 'tabela',
            cabecalho: [[{ texto: 'Caminho' }], [{ texto: 'Programa' }]],
            linhas: [[[{ texto: '1.6' }], [{ texto: 'CTB106' }]]],
          },
        ],
      },
      { titulo: 'Seção vazia', corpo: '   ', categoria: 'geral', blocos: [] },
    ],
    palavrasChave: ['CTB005', 'CTB101'],
    caminhoOrigem: 'c:/docs/modulos/01-ctb-contabilidade.md',
    urlOrigem: 'https://github.com/x/modulos/01-ctb-contabilidade.md',
    atualizadoEm: '2026-07-20T12:00:00Z',
  };
}

describe('DicionarioDocumentoComponent', () => {
  let fixtureAtual: ComponentFixture<DicionarioDocumentoComponent> | null = null;

  afterEach(() => {
    fixtureAtual?.destroy();
    fixtureAtual = null;
  });

  function montar(service: Partial<DicionarioService>, slug: string | null = '01-ctb-contabilidade') {
    TestBed.configureTestingModule({
      imports: [DicionarioDocumentoComponent],
      providers: [
        provideRouter([]),
        { provide: DicionarioService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => slug } } } },
      ],
    });
    fixtureAtual = TestBed.createComponent(DicionarioDocumentoComponent);
    fixtureAtual.detectChanges();
    return fixtureAtual;
  }

  async function esperarTexto(fixture: ComponentFixture<DicionarioDocumentoComponent>, trecho: string) {
    const limite = Date.now() + 2000;
    while (Date.now() < limite) {
      fixture.detectChanges();
      if ((fixture.nativeElement.textContent as string).includes(trecho)) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    fixture.detectChanges();
    throw new Error(`Texto "${trecho}" não apareceu. Atual: ${fixture.nativeElement.textContent}`);
  }

  it('renderiza o documento com título, parágrafo, tabela e fonte', async () => {
    const fixture = montar({ documento: () => Promise.resolve(detalhe()) });
    await esperarTexto(fixture, 'CTB - Contabilidade');
    // Espaço colapsado (o navegador junta o whitespace entre os segmentos inline).
    const texto = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
    expect(texto).toContain('CTB101 define parametros');
    expect(texto).toContain('01-ctb-contabilidade.md');
    // A tabela do bloco é renderizada como <table> de verdade (não markdown cru).
    const tabela = fixture.nativeElement.querySelector('table.doc-tab');
    expect(tabela).toBeTruthy();
    expect(tabela.querySelectorAll('th')).toHaveLength(2);
    expect(tabela.textContent).toContain('CTB106');
  });

  it('omite seções sem conteúdo', async () => {
    const fixture = montar({ documento: () => Promise.resolve(detalhe()) });
    await esperarTexto(fixture, 'CTB - Contabilidade');
    expect(fixture.componentInstance.secoesVisiveis()).toHaveLength(1);
  });

  it('mostra erro quando o documento não existe', async () => {
    const fixture = montar({ documento: () => Promise.reject(new Error('404')) });
    await esperarTexto(fixture, 'Documento não encontrado no Dicionário.');
  });
});
