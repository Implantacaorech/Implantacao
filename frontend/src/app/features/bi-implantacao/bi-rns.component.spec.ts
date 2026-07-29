import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiRnsComponent } from './bi-rns.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import { LinhaRnsBi, ResultadoRnsBi } from '../../core/models/bi-implantacao.model';

function linha(over: Partial<LinhaRnsBi> = {}): LinhaRnsBi {
  return {
    codigo: 56461001,
    rns: '564610-1',
    pedido: 564610,
    item: 1,
    dataCriacao: '2026-07-28',
    statusRns: '1-Redigida',
    sigla: 'CNV',
    sistema: 'Conversão',
    visaoGeral: '[BON] Conversão de histórico de vendas',
    versoesGeracao: '',
    validadaCliente: false,
    tipo: '6-Conversão',
    responsavel: 'Kailan',
    analista: 'Ana',
    cliente: 3729,
    fantasia: 'PLAQUES RS',
    rnsImplantacao: 138937,
    descricaoImplantacao: 'PLAQUES RS - Controladoria',
    statusImplantacao: '1-Não inciado',
    tecnico: 'Kailan',
    grupoEconomico: 'MANTAS BRASIL',
    ...over,
  };
}

function resultado(over: Partial<ResultadoRnsBi> = {}): ResultadoRnsBi {
  const linhas = over.linhas ?? [linha()];
  return {
    periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
    linhas,
    totais: { quantidade: linhas.length, validadas: 0, naoValidadas: linhas.length, implantacoes: 1 },
    porStatus: [{ chave: '1-Redigida', quantidade: 1 }],
    porSigla: [{ chave: 'CNV', quantidade: 1 }],
    filtros: {
      grupos: ['MANTAS BRASIL'],
      status: ['1-Redigida'],
      tecnicos: ['Kailan'],
      siglas: ['CNV'],
      tipos: ['6-Conversão'],
      statusImplantacao: ['1-Não inciado'],
      rns: [{ codigo: '138937', rotulo: '138937 — PLAQUES RS' }],
    },
    selecionados: {
      grupos: [], status: [], tecnicos: [], siglas: [], tipos: [],
      statusImplantacao: [], rns: [], validada: '',
    },
    erro: null,
    ...over,
  };
}

describe('BiRnsComponent', () => {
  function montar(service: Partial<BiImplantacaoService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiRnsComponent],
      providers: [provideRouter([]), { provide: BiImplantacaoService, useValue: service }],
    });
    return TestBed.createComponent(BiRnsComponent);
  }

  async function pronto(service: Partial<BiImplantacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega e adota o período do backend', async () => {
    const comp = await pronto({ rns: () => Promise.resolve(resultado()) });
    expect(comp.dataIni).toBe('2025-07-29');
    expect(comp.linhas()).toHaveLength(1);
  });

  it('a busca local cobre visão geral, cliente e número da RNS', async () => {
    const linhas = [
      linha({ codigo: 1, rns: '111-1', visaoGeral: 'Conversão de produtos', fantasia: 'ALFA',
              grupoEconomico: 'G1', sigla: 'CNV', tecnico: 'Ana' }),
      linha({ codigo: 2, rns: '222-1', visaoGeral: 'Ajuste no faturamento', fantasia: 'BETA',
              grupoEconomico: 'G2', sigla: 'FAT', tecnico: 'Bruno' }),
    ];
    const comp = await pronto({ rns: () => Promise.resolve(resultado({ linhas })) });

    comp.busca.set('faturamento');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([2]);
    comp.busca.set('alfa');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([1]);
    comp.busca.set('222');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([2]);
  });

  it('os painéis de contagem acompanham a busca local', async () => {
    const linhas = [
      linha({ codigo: 1, fantasia: 'ALFA', grupoEconomico: 'G1', statusRns: '1-Redigida',
              sigla: 'CNV', visaoGeral: 'a', tecnico: 'Ana' }),
      linha({ codigo: 2, fantasia: 'BETA', grupoEconomico: 'G2', statusRns: '10-Entregue',
              sigla: 'FAT', visaoGeral: 'b', tecnico: 'Bruno' }),
    ];
    const comp = await pronto({ rns: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.porStatusVisivel()).toHaveLength(2);

    comp.busca.set('ALFA');
    expect(comp.porStatusVisivel()).toEqual([{ chave: '1-Redigida', quantidade: 1 }]);
    expect(comp.porSiglaVisivel()).toEqual([{ chave: 'CNV', quantidade: 1 }]);
  });

  it('conta validadas e não validadas sobre o que está visível', async () => {
    const linhas = [
      linha({ codigo: 1, validadaCliente: true, fantasia: 'ALFA', grupoEconomico: 'G1', visaoGeral: 'a' }),
      linha({ codigo: 2, validadaCliente: false, fantasia: 'BETA', grupoEconomico: 'G2', visaoGeral: 'b' }),
    ];
    const comp = await pronto({ rns: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.totaisVisiveis()).toMatchObject({ quantidade: 2, validadas: 1, naoValidadas: 1 });

    comp.busca.set('ALFA');
    expect(comp.totaisVisiveis()).toMatchObject({ quantidade: 1, validadas: 1, naoValidadas: 0 });
  });

  it('a validação do cliente é tri-estado e vai ao backend', async () => {
    const rns = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ rns });
    rns.mockClear();

    comp.definirValidada('sim');
    await Promise.resolve();
    expect(rns).toHaveBeenCalledWith(expect.objectContaining({ validada: 'sim' }));
    expect(comp.qtdFiltrosAtivos()).toBe(1);

    comp.definirValidada('');
    await Promise.resolve();
    // vazio não deve ser enviado como filtro
    expect(rns).toHaveBeenLastCalledWith(expect.objectContaining({ validada: undefined }));
    expect(comp.qtdFiltrosAtivos()).toBe(0);
  });

  it('manda os filtros padrão ao backend', async () => {
    const rns = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ rns });
    rns.mockClear();

    comp.alternar(comp.rnsSel, '138937');
    await Promise.resolve();
    expect(rns).toHaveBeenCalledWith(expect.objectContaining({ rns: ['138937'] }));

    comp.alternar(comp.statusImpSel, '6-Concluída');
    await Promise.resolve();
    expect(rns).toHaveBeenLastCalledWith(
      expect.objectContaining({ rns: ['138937'], statusImplantacao: ['6-Concluída'] }),
    );
  });

  it('limpar zera inclusive a validação e a busca dos blocos', async () => {
    const comp = await pronto({ rns: () => Promise.resolve(resultado()) });
    comp.statusSel.set(['1-Redigida']);
    comp.definirValidada('nao');
    comp.definirTermoOpcao('grupo', 'abc');
    comp.busca.set('x');

    await comp.limparFiltros();
    expect(comp.qtdFiltrosAtivos()).toBe(0);
    expect(comp.validada()).toBe('');
    expect(comp.termoOpcao('grupo')).toBe('');
  });

  it('ordena e inverte no mesmo campo', async () => {
    const linhas = [linha({ codigo: 1, pedido: 100 }), linha({ codigo: 2, pedido: 200 })];
    const comp = await pronto({ rns: () => Promise.resolve(resultado({ linhas })) });
    comp.ordenar('pedido');
    expect(comp.linhas().map((l) => l.pedido)).toEqual([200, 100]);
    comp.ordenar('pedido');
    expect(comp.linhas().map((l) => l.pedido)).toEqual([100, 200]);
  });

  it('colore o status pelo prefixo numérico', async () => {
    const comp = await pronto({ rns: () => Promise.resolve(resultado()) });
    expect(comp.corStatus('99-Cancelada')).toBe('#c62828');
    expect(comp.corStatus('10-Entregue')).toBe('#2e7d32');
    expect(comp.corStatus('0-Pendência')).toBe('#ef6c00');
    expect(comp.corStatus('7-Qualquer')).toBe('#78909c');
  });

  it('mostra erro do backend sem quebrar', async () => {
    const comp = await pronto({
      rns: () => Promise.resolve(resultado({ erro: 'ORA-00942', linhas: [] })),
    });
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.linhas()).toEqual([]);
  });
});
