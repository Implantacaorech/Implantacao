import { TestBed } from '@angular/core/testing';
import { ConsultorSigerComponent } from './consultor-siger.component';
import { ConsultorSigerService } from '../../core/services/consultor-siger.service';
import { RespostaConsultorSiger } from '../../core/models/consultor-siger.model';

function resposta(over: Partial<RespostaConsultorSiger> = {}): RespostaConsultorSiger {
  return {
    pergunta: 'como funciona o faturamento?',
    visao: 'funcional',
    disponivel: true,
    interpretacao: { acao: 'funcionamento', termos: ['faturamento'], termosExpandidos: [] },
    secoes: {
      resumo: [
        {
          texto: 'Faturamento é um dos módulos do SIGER (código FAT).',
          fonte: {
            arquivo: 'F:\\SIGER\\23.10b\\fon\\FAT005.CBL',
            linha: 2,
            versao: '23.10b',
            referencia: 'módulo FAT',
            tipo: 'modulo',
          },
        },
      ],
    },
    assuntosRelacionados: [{ titulo: 'Estoque', pesquisa: 'como funciona estoque' }],
    sugestoes: ['quais parâmetros controlam faturamento'],
    fontes: [
      {
        arquivo: 'F:\\SIGER\\23.10b\\fon\\FAT005.CBL',
        linha: 2,
        versao: '23.10b',
        referencia: 'módulo FAT',
        tipo: 'modulo',
      },
    ],
    confianca: 'alta',
    aviso: null,
    ...over,
  };
}

describe('ConsultorSigerComponent', () => {
  let pesquisas: Array<{ q: string; visao: string }>;
  let respostaFake: RespostaConsultorSiger;

  beforeEach(() => {
    localStorage.clear();
    pesquisas = [];
    respostaFake = resposta();
    TestBed.configureTestingModule({
      imports: [ConsultorSigerComponent],
      providers: [
        {
          provide: ConsultorSigerService,
          useValue: {
            pesquisar: (q: string, visao: string) => {
              pesquisas.push({ q, visao });
              return Promise.resolve(respostaFake);
            },
            enviarFeedback: () => Promise.resolve(),
          },
        },
      ],
    });
  });

  function criar() {
    const fixture = TestBed.createComponent(ConsultorSigerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('pesquisa e renderiza as seções com a fonte citada', async () => {
    const fixture = criar();
    const comp = fixture.componentInstance;
    await comp.pesquisar('como funciona o faturamento?');
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Resumo');
    expect(texto).toContain('Faturamento é um dos módulos');
    expect(texto).toContain('FAT005.CBL:2');
    expect(texto).toContain('Alta confiança');
    expect(pesquisas).toEqual([{ q: 'como funciona o faturamento?', visao: 'funcional' }]);
  });

  it('guarda a pergunta no histórico (localStorage) sem duplicar', async () => {
    const comp = criar().componentInstance;
    await comp.pesquisar('como funciona o faturamento?');
    await comp.pesquisar('como funciona o faturamento?');
    expect(comp.historico()).toEqual(['como funciona o faturamento?']);
    expect(JSON.parse(localStorage.getItem('consultor_siger.historico') ?? '[]')).toEqual([
      'como funciona o faturamento?',
    ]);
  });

  it('clicar num assunto relacionado dispara nova pesquisa', async () => {
    const fixture = criar();
    await fixture.componentInstance.pesquisar('como funciona o faturamento?');
    fixture.detectChanges();
    const chip = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Estoque'),
    );
    expect(chip).toBeTruthy();
    chip!.click();
    await fixture.whenStable();
    expect(pesquisas.map((p) => p.q)).toContain('como funciona estoque');
  });

  it('resposta sem evidência mostra o aviso de não confirmado', async () => {
    respostaFake = resposta({
      secoes: {},
      assuntosRelacionados: [],
      sugestoes: [],
      fontes: [],
      confianca: 'nao_confirmado',
      aviso: 'Não foi localizada evidência suficiente na fonte do SIGER.',
    });
    const fixture = criar();
    await fixture.componentInstance.pesquisar('xyzk');
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Não foi localizada evidência');
    expect(texto).toContain('Não confirmado');
  });

  it('favoritar registra e desfaz', async () => {
    const comp = criar().componentInstance;
    await comp.pesquisar('como funciona o faturamento?');
    comp.alternarFavorito();
    expect(comp.ehFavorita('como funciona o faturamento?')).toBe(true);
    comp.alternarFavorito();
    expect(comp.ehFavorita('como funciona o faturamento?')).toBe(false);
  });
});
