import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BiFiltrosStore } from './bi-filtros.store';
import { BiImplantacaoComponent } from './bi-implantacao.component';
import { BiExtratoComponent } from './bi-extrato.component';
import { BiRnsComponent } from './bi-rns.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';

const vazioResumo = {
  periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
  linhas: [], totais: {}, porStatus: [], porTecnico: [],
  filtros: { grupos: [], status: [], tecnicos: [], ativos: [], tiposCliente: [], rns: [] },
  selecionados: {}, erro: null,
};
const vazioExtrato = {
  periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
  linhas: [], totais: { lancamentos: 0, horasUtilizadas: 0, saldoAtual: null },
  filtros: { grupos: [], tecnicos: [], siglas: [], clientes: [], status: [], rns: [] },
  selecionados: {}, truncado: false, erro: null,
};
const vazioRns = {
  periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
  linhas: [], totais: { quantidade: 0, validadas: 0, naoValidadas: 0, implantacoes: 0 },
  porStatus: [], porSigla: [],
  filtros: {
    grupos: [], status: [], tecnicos: [], siglas: [], tipos: [], statusImplantacao: [], rns: [],
  },
  selecionados: {}, erro: null,
};

describe('BiFiltrosStore', () => {
  /** O store agora salva os filtros no usuário logado (`filtrosSalvos`), o que exige contexto
   * de injeção e HttpClient — daí vir pelo TestBed em vez de `new`. Sem sessão no
   * localStorage o PreferenciasService não chama o servidor, então não há requisição a
   * despachar nestes testes. */
  function novoStore(): BiFiltrosStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return TestBed.inject(BiFiltrosStore);
  }

  it('limpar zera seleções e busca, mas PRESERVA o período', () => {
    const store = novoStore();
    store.dataIni.set('2026-01-01');
    store.dataFim.set('2026-03-31');
    store.grupo.set(['G1']);
    store.validada.set('sim');
    store.busca.set('abc');
    store.definirTermoOpcao('grupo', 'xyz');

    store.limpar();

    expect(store.grupo()).toEqual([]);
    expect(store.validada()).toBe('');
    expect(store.busca()).toBe('');
    expect(store.termoOpcao('grupo')).toBe('');
    // o período é o recorte de trabalho, não um filtro de detalhe
    expect(store.dataIni()).toBe('2026-01-01');
    expect(store.dataFim()).toBe('2026-03-31');
  });

  it('o painel de filtros nasce FECHADO', () => {
    expect(novoStore().filtrosAbertos()).toBe(false);
  });

  it('alternarFiltros abre e recolhe', () => {
    const store = novoStore();
    store.alternarFiltros();
    expect(store.filtrosAbertos()).toBe(true);
    store.alternarFiltros();
    expect(store.filtrosAbertos()).toBe(false);
  });

  it('limpar não reabre o painel', () => {
    const store = novoStore();
    store.grupo.set(['G1']);
    store.limpar();
    expect(store.filtrosAbertos()).toBe(false);
  });

  it('alternar adiciona e remove', () => {
    const store = novoStore();
    store.alternar(store.tecnico, 'Ana');
    store.alternar(store.tecnico, 'Bruno');
    expect(store.tecnico()).toEqual(['Ana', 'Bruno']);
    store.alternar(store.tecnico, 'Ana');
    expect(store.tecnico()).toEqual(['Bruno']);
  });

  it('conta os filtros ativos sem contar a busca textual', () => {
    const store = novoStore();
    expect(store.qtdAtivos()).toBe(0);
    store.grupo.set(['G1', 'G2']);
    store.validada.set('nao');
    store.busca.set('procura');
    expect(store.qtdAtivos()).toBe(3); // 2 grupos + validada; a busca não conta
  });
});

/** Pedido do usuário em 2026-07-29: "os filtros quando aplicados devem ser aplicados em
 * todas as abas". Trocar de aba destrói e recria o componente — o estado tem de viver fora
 * dele. Estes testes montam DUAS páginas no mesmo injector e conferem a travessia. */
describe('filtros compartilhados entre as abas', () => {
  const service = {
    resumo: vi.fn().mockResolvedValue(vazioResumo),
    extrato: vi.fn().mockResolvedValue(vazioExtrato),
    rns: vi.fn().mockResolvedValue(vazioRns),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service.resumo.mockResolvedValue(vazioResumo);
    service.extrato.mockResolvedValue(vazioExtrato);
    service.rns.mockResolvedValue(vazioRns);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BiImplantacaoService, useValue: service }],
    });
  });

  async function montar<T>(tipo: Type<T>): Promise<T> {
    const f = TestBed.createComponent(tipo);
    f.detectChanges();
    await f.whenStable();
    return f.componentInstance;
  }

  it('grupo marcado no Resumo chega ao Extrato e à página RNS', async () => {
    const resumo = await montar(BiImplantacaoComponent);
    resumo.alternar(resumo.gruposSel, 'MANTAS BRASIL');
    await Promise.resolve();

    service.extrato.mockClear();
    await montar(BiExtratoComponent);
    expect(service.extrato).toHaveBeenCalledWith(
      expect.objectContaining({ grupo: ['MANTAS BRASIL'] }),
    );

    service.rns.mockClear();
    await montar(BiRnsComponent);
    expect(service.rns).toHaveBeenCalledWith(
      expect.objectContaining({ grupo: ['MANTAS BRASIL'] }),
    );
  });

  it('consultor e RNS de implantação também atravessam as abas', async () => {
    const extrato = await montar(BiExtratoComponent);
    extrato.alternar(extrato.tecnicosSel, 'Jolemar');
    extrato.alternar(extrato.rnsSel, '138935');
    await Promise.resolve();

    service.resumo.mockClear();
    await montar(BiImplantacaoComponent);
    expect(service.resumo).toHaveBeenCalledWith(
      expect.objectContaining({ tecnico: ['Jolemar'], rns: ['138935'] }),
    );
  });

  it('o período escolhido numa aba vale na outra', async () => {
    const resumo = await montar(BiImplantacaoComponent);
    resumo.dataIni = '2026-01-01';
    resumo.dataFim = '2026-03-31';

    service.extrato.mockClear();
    await montar(BiExtratoComponent);
    expect(service.extrato).toHaveBeenCalledWith(
      expect.objectContaining({ dataIni: '2026-01-01', dataFim: '2026-03-31' }),
    );
  });

  it('o status da IMPLANTAÇÃO é o mesmo filtro nas três telas', async () => {
    const resumo = await montar(BiImplantacaoComponent);
    resumo.alternar(resumo.statusSel, '6-Concluída');
    await Promise.resolve();

    service.rns.mockClear();
    await montar(BiRnsComponent);
    // na página RNS ele viaja como `statusImplantacao`, não como `status`
    expect(service.rns).toHaveBeenCalledWith(
      expect.objectContaining({ statusImplantacao: ['6-Concluída'] }),
    );
  });

  it('o status da RNS filha NÃO se mistura com o status da implantação', async () => {
    const rns = await montar(BiRnsComponent);
    rns.alternar(rns.statusSel, '10-Entregue'); // status da RNS filha
    await Promise.resolve();

    service.resumo.mockClear();
    await montar(BiImplantacaoComponent);
    // o Resumo filtra status da IMPLANTAÇÃO — não pode herdar "10-Entregue"
    expect(service.resumo).toHaveBeenCalledWith(expect.objectContaining({ status: [] }));
  });

  it('limpar numa aba limpa também o que só existe na outra', async () => {
    const rns = await montar(BiRnsComponent);
    rns.alternar(rns.tiposSel, '6-Conversão');
    rns.definirValidada('sim');
    await Promise.resolve();

    const extrato = await montar(BiExtratoComponent);
    await extrato.limparFiltros();

    const store = TestBed.inject(BiFiltrosStore);
    expect(store.tipo()).toEqual([]);
    expect(store.validada()).toBe('');
  });
});
