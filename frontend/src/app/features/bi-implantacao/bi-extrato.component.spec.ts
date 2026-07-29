import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiExtratoComponent } from './bi-extrato.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import { LinhaExtratoBi, ResultadoExtratoBi } from '../../core/models/bi-implantacao.model';

function linha(over: Partial<LinhaExtratoBi> = {}): LinhaExtratoBi {
  return {
    rns: 138935,
    cliente: 3180,
    protocolo: 1435877,
    data: '2026-07-29',
    hora: '10:35',
    sigla: 'FAT',
    tecnico: 'Ramon',
    assunto: 'DEG / DALCERO RNI 138935',
    sistema: 'Faturamento',
    descricao: 'Configuração do módulo de vendas',
    descricaoTamanho: 31,
    descricaoTruncada: false,
    horasUtilizadas: 0.55,
    saldoAcumulado: 1.45,
    fantasia: 'DEG / DALCERO',
    grupoEconomico: 'DEG / DALCERO',
    statusRns: '1-Não inciado',
    rnsDescricao: 'DEG - Adendo FAT e NFE',
    ...over,
  };
}

function resultado(over: Partial<ResultadoExtratoBi> = {}): ResultadoExtratoBi {
  const linhas = over.linhas ?? [linha()];
  return {
    periodo: { inicio: '2026-01-29', fim: '2026-07-29' },
    linhas,
    totais: { lancamentos: linhas.length, horasUtilizadas: 0.55, saldoAtual: 1.45 },
    filtros: {
      grupos: ['DEG / DALCERO'],
      tecnicos: ['Ramon'],
      siglas: ['FAT'],
      clientes: ['DEG / DALCERO'],
      status: ['1-Não inciado'],
      rns: [{ codigo: '138935', rotulo: '138935 — DEG / DALCERO' }],
    },
    selecionados: {
      grupos: [], tecnicos: [], siglas: [], clientes: [], status: [], rns: [],
    },
    truncado: false,
    erro: null,
    ...over,
  };
}

describe('BiExtratoComponent', () => {
  function montar(service: Partial<BiImplantacaoService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiExtratoComponent],
      providers: [provideRouter([]), { provide: BiImplantacaoService, useValue: service }],
    });
    return TestBed.createComponent(BiExtratoComponent);
  }

  async function pronto(service: Partial<BiImplantacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega o extrato e adota o período do backend', async () => {
    const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
    expect(comp.dataIni).toBe('2026-01-29');
    expect(comp.linhas()).toHaveLength(1);
    expect(comp.erro()).toBeNull();
  });

  it('avisa quando o recorte veio truncado', async () => {
    const comp = await pronto({ extrato: () => Promise.resolve(resultado({ truncado: true })) });
    expect(comp.truncado()).toBe(true);
  });

  it('a busca local cobre assunto, cliente, consultor, sigla e protocolo', async () => {
    const linhas = [
      linha({ protocolo: 111, assunto: 'Ajuste no faturamento', fantasia: 'ALFA',
              tecnico: 'Ana', sigla: 'FAT', grupoEconomico: 'G1' }),
      linha({ protocolo: 222, assunto: 'Conciliação bancária', fantasia: 'BETA',
              tecnico: 'Bruno', sigla: 'FIN', grupoEconomico: 'G2' }),
    ];
    const comp = await pronto({ extrato: () => Promise.resolve(resultado({ linhas })) });

    comp.busca.set('bruno');
    expect(comp.linhas().map((l) => l.protocolo)).toEqual([222]);
    comp.busca.set('FAT');
    expect(comp.linhas().map((l) => l.protocolo)).toEqual([111]);
    comp.busca.set('222');
    expect(comp.linhas().map((l) => l.protocolo)).toEqual([222]);
    comp.busca.set('');
    expect(comp.linhas()).toHaveLength(2);
  });

  it('os totais acompanham a busca local', async () => {
    const linhas = [
      linha({ protocolo: 1, fantasia: 'ALFA', grupoEconomico: 'G1', tecnico: 'Ana',
              assunto: 'a', horasUtilizadas: 2, saldoAcumulado: 10 }),
      linha({ protocolo: 2, fantasia: 'BETA', grupoEconomico: 'G2', tecnico: 'Bruno',
              assunto: 'b', horasUtilizadas: 3, saldoAcumulado: 20 }),
    ];
    const comp = await pronto({ extrato: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.totaisVisiveis()).toMatchObject({
      lancamentos: 2, horasUtilizadas: 5, consultores: 2, clientes: 2,
    });

    comp.busca.set('ALFA');
    expect(comp.totaisVisiveis()).toMatchObject({
      lancamentos: 1, horasUtilizadas: 2, consultores: 1, clientes: 1,
    });
    // saldo "de agora" = o do lançamento mais recente visível
    expect(comp.totaisVisiveis().saldoAtual).toBe(10);
  });

  it('corta a prévia em 60 caracteres e tira as quebras de linha', async () => {
    const texto = 'a'.repeat(200);
    const comp = await pronto({
      extrato: () => Promise.resolve(resultado({ linhas: [linha({ descricao: texto })] })),
    });
    const l = comp.linhas()[0];
    expect(comp.previa(l)).toBe(`${'a'.repeat(60)}…`);

    const comQuebras = linha({ descricao: 'linha 1\r\nlinha 2\nlinha 3' });
    expect(comp.previa(comQuebras)).toBe('linha 1 linha 2 linha 3');
  });

  it('não vai ao banco quando a descrição já veio inteira', async () => {
    const descricao = vi.fn();
    const comp = await pronto({
      extrato: () => Promise.resolve(resultado({ linhas: [linha({ descricaoTruncada: false })] })),
      descricao,
    });
    await comp.alternarDescricao(comp.linhas()[0]);
    expect(descricao).not.toHaveBeenCalled();
    expect(comp.textoAberto()).toBe('Configuração do módulo de vendas');
  });

  it('busca o texto completo quando a descrição está truncada', async () => {
    const descricao = vi.fn().mockResolvedValue({
      descricao: 'texto completo do atendimento', tamanho: 900, erro: null,
    });
    const comp = await pronto({
      extrato: () =>
        Promise.resolve(resultado({
          linhas: [linha({ descricaoTruncada: true, descricaoTamanho: 900 })],
        })),
      descricao,
    });
    await comp.alternarDescricao(comp.linhas()[0]);
    expect(descricao).toHaveBeenCalledWith(1435877, '2026-07-29 10:35');
    expect(comp.textoAberto()).toBe('texto completo do atendimento');
  });

  it('mantém a prévia e avisa quando a busca do texto completo falha', async () => {
    const comp = await pronto({
      extrato: () =>
        Promise.resolve(resultado({ linhas: [linha({ descricaoTruncada: true })] })),
      descricao: () => Promise.reject(new Error('rede')),
    });
    await comp.alternarDescricao(comp.linhas()[0]);
    expect(comp.textoAberto()).toContain('Configuração do módulo de vendas');
    expect(comp.textoAberto()).toContain('não foi possível carregar');
  });

  it('clicar de novo fecha a descrição', async () => {
    const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
    const l = comp.linhas()[0];
    await comp.alternarDescricao(l);
    expect(comp.abertoId()).toBe(comp.chaveDe(l));
    await comp.alternarDescricao(l);
    expect(comp.abertoId()).toBeNull();
  });

  it('marcar filtro recarrega e limpar zera tudo', async () => {
    const extrato = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ extrato });
    extrato.mockClear();

    comp.alternar(comp.siglasSel, 'FAT');
    await Promise.resolve();
    expect(extrato).toHaveBeenCalledWith(expect.objectContaining({ sigla: ['FAT'] }));
    expect(comp.qtdFiltrosAtivos()).toBe(1);

    comp.busca.set('x');
    await comp.limparFiltros();
    expect(comp.qtdFiltrosAtivos()).toBe(0);
  });

  it('formata horas com 2 casas e data em pt-BR', async () => {
    const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
    expect(comp.horas(0.5)).toBe('0,50');
    expect(comp.horas(1234.567)).toBe('1.234,57');
    expect(comp.dataBr('2026-07-29')).toBe('29/07/2026');
  });

  it('a chave do item combina protocolo e data/hora (protocolo pode repetir)', async () => {
    const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
    expect(comp.chaveDe(comp.linhas()[0])).toBe('1435877|2026-07-29 10:35');
  });

  // ── Os 4 filtros padrão: grupo econômico, RNS, status da RNS e consultor ──────────
  describe('filtros padrão', () => {
    it('manda RNS e status da RNS ao backend', async () => {
      const extrato = vi.fn().mockResolvedValue(resultado());
      const comp = await pronto({ extrato });
      extrato.mockClear();

      comp.alternar(comp.rnsSel, '138935');
      await Promise.resolve();
      expect(extrato).toHaveBeenCalledWith(expect.objectContaining({ rns: ['138935'] }));

      comp.alternar(comp.statusSel, '6-Concluída');
      await Promise.resolve();
      expect(extrato).toHaveBeenLastCalledWith(
        expect.objectContaining({ rns: ['138935'], status: ['6-Concluída'] }),
      );
      expect(comp.qtdFiltrosAtivos()).toBe(2);
    });

    it('a busca por bloco ignora acento e caixa', async () => {
      const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
      const lista = ['COCOLÂNDIA / DRM', 'DEG / DALCERO'];

      comp.definirTermoOpcao('cliente', 'cocolandia');
      expect(comp.opcoes('cliente', lista, comp.clientesSel).visiveis).toEqual([
        'COCOLÂNDIA / DRM',
      ]);
    });

    it('a busca do bloco de RNS casa por número e por cliente', async () => {
      const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
      const lista = [
        { codigo: '138935', rotulo: '138935 — DEG / DALCERO' },
        { codigo: '138900', rotulo: '138900 — COCOLANDIA / DRM' },
      ];
      comp.definirTermoOpcao('rns', '138900');
      expect(comp.opcoesRns('rns', lista).visiveis.map((o) => o.codigo)).toEqual(['138900']);

      comp.definirTermoOpcao('rns', 'dalcero');
      expect(comp.opcoesRns('rns', lista).visiveis.map((o) => o.codigo)).toEqual(['138935']);
    });

    it('opção MARCADA nunca some da lista, mesmo fora da busca', async () => {
      const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
      comp.clientesSel.set(['DEG / DALCERO']);
      comp.definirTermoOpcao('cliente', 'cocolandia');
      const visiveis = comp.opcoes('cliente', ['COCOLÂNDIA / DRM', 'DEG / DALCERO'], comp.clientesSel).visiveis;
      // senão o usuário não conseguiria desmarcar o que já escolheu
      expect(visiveis).toContain('DEG / DALCERO');
    });

    it('corta a lista no teto e informa quantas ficaram de fora', async () => {
      const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
      const lista = Array.from({ length: 100 }, (_, i) => `CLIENTE ${i}`);
      const r = comp.opcoes('cliente', lista, comp.clientesSel);
      expect(r.visiveis).toHaveLength(80);
      expect(r.ocultas).toBe(20);
    });

    it('limpar zera também a busca dos blocos', async () => {
      const comp = await pronto({ extrato: () => Promise.resolve(resultado()) });
      comp.definirTermoOpcao('cliente', 'abc');
      await comp.limparFiltros();
      expect(comp.termoOpcao('cliente')).toBe('');
    });
  });
});
