import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiImplantacaoComponent } from './bi-implantacao.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import {
  LinhaResumoBi,
  LinhaVisitaPortalBi,
  ResultadoResumoBi,
  ResultadoVisitasPortalBi,
} from '../../core/models/bi-implantacao.model';

function linha(over: Partial<LinhaResumoBi> = {}): LinhaResumoBi {
  return {
    codigo: 1,
    cliente: 10,
    descricao: 'Implantação módulo X',
    fantasia: 'ALFA',
    tecnico: 'Jolemar',
    statusRns: '6-Concluída',
    tipo: 1,
    dataContratacao: '2026-06-10',
    dataPrevUso: '',
    dataEncerramento: '',
    horasPrevistas: 10,
    horasRealizadas: 4,
    horasSaldo: 6,
    horasCobradas: 0,
    horasBonificadas: 10,
    grupoEconomico: 'GRUPO ALFA',
    ativoDes: 'Sim',
    tipoDes: 'Cliente',
    ...over,
  };
}

function resultado(over: Partial<ResultadoResumoBi> = {}): ResultadoResumoBi {
  const linhas = over.linhas ?? [linha()];
  return {
    periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
    linhas,
    totais: {
      quantidade: linhas.length,
      horasPrevistas: 10,
      horasRealizadas: 4,
      horasSaldo: 6,
      horasSaldoCalculado: 6,
      horasCobradas: 0,
      horasBonificadas: 10,
      percentualUtilizacao: 40,
    },
    porStatus: [
      { chave: '6-Concluída', quantidade: 1, horasPrevistas: 10, horasRealizadas: 4, horasSaldo: 6 },
    ],
    porTecnico: [
      { chave: 'Jolemar', quantidade: 1, horasPrevistas: 10, horasRealizadas: 4, horasSaldo: 6 },
    ],
    filtros: {
      grupos: ['GRUPO ALFA'],
      status: ['6-Concluída'],
      tecnicos: ['Jolemar'],
      ativos: ['Sim'],
      tiposCliente: ['Cliente'],
      rns: [{ codigo: '1', rotulo: '1 — ALFA' }],
    },
    selecionados: {
      grupos: [], status: [], tecnicos: [], ativos: [], tiposCliente: [], rns: [],
    },
    erro: null,
    ...over,
  };
}

function visita(over: Partial<LinhaVisitaPortalBi> = {}): LinhaVisitaPortalBi {
  return {
    empresa: 'ALFA',
    cliente: 10,
    contato: 'Iloni',
    consultor: 'Remeling',
    protocolo: 4821,
    data: '2026-08-13',
    horario: '08:30:00',
    turno: 'MANHÃ',
    aprovado: 'Sim',
    ...over,
  };
}

function resultadoVisitas(
  over: Partial<ResultadoVisitasPortalBi> = {},
): ResultadoVisitasPortalBi {
  const linhas = over.linhas ?? [];
  return {
    periodo: { inicio: '2025-07-29', fim: '2026-07-29' },
    linhas,
    total: linhas.length,
    limite: 5000,
    truncado: false,
    erro: null,
    ...over,
  };
}

describe('BiImplantacaoComponent', () => {
  function montar(service: Partial<BiImplantacaoService>) {
    // Alguns testes montam o componente mais de uma vez (varrendo faixas de percentual);
    // sem o reset, o TestBed recusa uma segunda configuração.
    TestBed.resetTestingModule();
    // O componente sempre busca as visitas do Portal junto com o resumo — os testes que
    // não são sobre o painel ganham um mock vazio para não estourar em `undefined`.
    const completo: Partial<BiImplantacaoService> = {
      visitasPortal: () => Promise.resolve(resultadoVisitas()),
      ...service,
    };
    TestBed.configureTestingModule({
      imports: [BiImplantacaoComponent],
      providers: [provideRouter([]), { provide: BiImplantacaoService, useValue: completo }],
    });
    return TestBed.createComponent(BiImplantacaoComponent);
  }

  async function pronto(service: Partial<BiImplantacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega o resumo e adota o período devolvido pelo backend', async () => {
    const comp = await pronto({ resumo: () => Promise.resolve(resultado()) });
    expect(comp.dataIni).toBe('2025-07-29');
    expect(comp.dataFim).toBe('2026-07-29');
    expect(comp.linhas()).toHaveLength(1);
    expect(comp.erro()).toBeNull();
  });

  it('mostra o erro devolvido pelo backend (SICLA fora do ar) sem quebrar a tela', async () => {
    const comp = await pronto({
      resumo: () => Promise.resolve(resultado({ erro: 'Conexão não configurada.', linhas: [] })),
    });
    expect(comp.erro()).toContain('Conexão não configurada');
    expect(comp.linhas()).toEqual([]);
  });

  it('a busca local filtra por cliente, grupo e número da RNS', async () => {
    const linhas = [
      linha({ codigo: 100, fantasia: 'ALFA', grupoEconomico: 'GRUPO ALFA' }),
      linha({ codigo: 200, fantasia: 'BETA', grupoEconomico: 'GRUPO BETA' }),
    ];
    const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });

    comp.busca.set('beta');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([200]);

    comp.busca.set('100');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([100]);

    comp.busca.set('');
    expect(comp.linhas()).toHaveLength(2);
  });

  it('os totais visíveis acompanham a busca local', async () => {
    const linhas = [
      linha({ codigo: 100, fantasia: 'ALFA', grupoEconomico: 'GRUPO ALFA',
              horasRealizadas: 4, horasPrevistas: 10, horasSaldo: 6 }),
      linha({ codigo: 200, fantasia: 'BETA', grupoEconomico: 'GRUPO BETA',
              horasRealizadas: 8, horasPrevistas: 20, horasSaldo: 12 }),
    ];
    const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.totaisVisiveis()).toMatchObject({ quantidade: 2, horasRealizadas: 12 });

    comp.busca.set('ALFA');
    expect(comp.totaisVisiveis()).toMatchObject({ quantidade: 1, horasRealizadas: 4 });
  });

  it('ordenar pelo mesmo campo inverte a direção', async () => {
    const linhas = [linha({ codigo: 100 }), linha({ codigo: 200 })];
    const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });

    comp.ordenar('codigo');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([200, 100]);
    comp.ordenar('codigo');
    expect(comp.linhas().map((l) => l.codigo)).toEqual([100, 200]);
  });

  it('marcar um filtro recarrega mandando a seleção ao backend', async () => {
    const resumo = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ resumo });
    resumo.mockClear();

    comp.alternar(comp.statusSel, '6-Concluída');
    await Promise.resolve();
    expect(resumo).toHaveBeenCalledWith(expect.objectContaining({ status: ['6-Concluída'] }));
    expect(comp.qtdFiltrosAtivos()).toBe(1);
  });

  it('limpar zera todos os filtros e a busca', async () => {
    const resumo = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ resumo });
    comp.statusSel.set(['6-Concluída']);
    comp.tecnicosSel.set(['Jolemar']);
    comp.busca.set('alfa');

    await comp.limparFiltros();
    expect(comp.qtdFiltrosAtivos()).toBe(0);
    expect(comp.busca()).toBe('');
  });

  it('formata horas em pt-BR e usa travessão para zero/vazio', async () => {
    const comp = await pronto({ resumo: () => Promise.resolve(resultado()) });
    expect(comp.horas(12.5)).toBe('12,5 h');
    expect(comp.horas(0)).toBe('—');
    expect(comp.dataBr('2026-06-10')).toBe('10/06/2026');
    expect(comp.dataBr('')).toBe('—');
  });

  it('usa a cor do status pelo prefixo numérico, como no relatório original', async () => {
    const comp = await pronto({ resumo: () => Promise.resolve(resultado()) });
    expect(comp.corStatus('6-Concluída')).toBe('#2E7D32');
    expect(comp.corStatus('8-Cancelada')).toBe('#F44336');
    expect(comp.corStatus('status desconhecido')).toBe('#78909C');
  });

  // ── CONTROLE DE HORAS: regras copiadas da medida DAX Grafico_Horas_HTML ──────────
  describe('controleHoras', () => {
    async function comHoras(previstas: number, realizadas: number) {
      const linhas = [linha({ horasPrevistas: previstas, horasRealizadas: realizadas })];
      return pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
    }

    it('saldo é previstas − realizadas (não a coluna HORASALDO)', async () => {
      const linhas = [linha({ horasPrevistas: 10, horasRealizadas: 4, horasSaldo: 999 })];
      const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
      expect(comp.controleHoras().saldo).toBe(6);
    });

    it('classifica o status e a cor por faixa de percentual', async () => {
      const faixas: [number, number, string, string][] = [
        [100, 10, 'INICIADO', '#10b981'],
        [100, 40, 'DESENVOLVIMENTO', '#fbbf24'],
        [100, 60, 'AVANÇADO', '#fb923c'],
        [100, 90, 'FINALIZADO', '#ef4444'],
        [100, 130, 'ULTRAPASSADO', '#1f2937'],
      ];
      for (const [prev, real, status, cor] of faixas) {
        const comp = await comHoras(prev, real);
        expect(comp.controleHoras().status).toBe(status);
        expect(comp.controleHoras().corStatus).toBe(cor);
      }
    });

    it('as bordas das faixas pertencem à faixa de baixo (<=25, <=50, …)', async () => {
      expect((await comHoras(100, 25)).controleHoras().status).toBe('INICIADO');
      expect((await comHoras(100, 50)).controleHoras().status).toBe('DESENVOLVIMENTO');
      expect((await comHoras(100, 100)).controleHoras().status).toBe('FINALIZADO');
    });

    it('até 100%: marcador na posição do percentual e faixas de 25%', async () => {
      const c = (await comHoras(100, 42)).controleHoras();
      expect(c.temExcedente).toBe(false);
      expect(c.larguraFaixa).toBe(25);
      expect(c.posicaoMarcador).toBe(42);
    });

    it('acima de 100%: faixas comprimem para 21,25% e o marcador entra no excedente', async () => {
      const c = (await comHoras(100, 120)).controleHoras();
      expect(c.temExcedente).toBe(true);
      expect(c.larguraFaixa).toBe(21.25);
      // 85 + (120 - 100) * 0.15 = 88
      expect(c.posicaoMarcador).toBe(88);
    });

    it('o marcador satura em 150% (não escapa da régua)', async () => {
      const c = (await comHoras(100, 900)).controleHoras();
      // 85 + (150 - 100) * 0.15 = 92.5
      expect(c.posicaoMarcador).toBe(92.5);
      expect(c.percentual).toBe(900);
    });

    it('sem horas previstas, o percentual é 0 e nada quebra', async () => {
      const c = (await comHoras(0, 0)).controleHoras();
      expect(c.percentual).toBe(0);
      expect(c.status).toBe('INICIADO');
      expect(c.posicaoMarcador).toBe(0);
    });

    it('saldo negativo muda a cor do card', async () => {
      expect((await comHoras(10, 25)).controleHoras().corSaldo).toBe('#ef4444');
      expect((await comHoras(10, 4)).controleHoras().corSaldo).toBe('#10b981');
    });

    it('formata horas inteiras e saldo com sinal, como o FORMAT do DAX', async () => {
      const comp = await comHoras(100, 40);
      expect(comp.horasInteiras(6098.5)).toBe('6.099h');
      expect(comp.saldoComSinal(3504.8)).toBe('+3.505h');
      expect(comp.saldoComSinal(-15)).toBe('-15h');
      expect(comp.saldoComSinal(0)).toBe('0h');
    });

    it('acompanha a busca local (recalcula sobre as linhas visíveis)', async () => {
      const linhas = [
        linha({ codigo: 1, fantasia: 'ALFA', grupoEconomico: 'G1', horasPrevistas: 100, horasRealizadas: 10 }),
        linha({ codigo: 2, fantasia: 'BETA', grupoEconomico: 'G2', horasPrevistas: 100, horasRealizadas: 90 }),
      ];
      const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
      expect(comp.controleHoras().percentual).toBe(50);

      comp.busca.set('ALFA');
      expect(comp.controleHoras().percentual).toBe(10);
      expect(comp.controleHoras().status).toBe('INICIADO');
    });
  });

  // Regressão: a busca é local, então os agrupamentos vindos do backend estão "atrasados".
  // TODO painel da tela precisa derivar das linhas visíveis, senão o gráfico mostra um
  // conjunto e a tabela logo abaixo mostra outro.
  it('TODOS os painéis acompanham a busca local, não só a tabela', async () => {
    const linhas = [
      linha({ codigo: 1, fantasia: 'ALFA', grupoEconomico: 'G1', tecnico: 'Ana',
              statusRns: '6-Concluída', dataContratacao: '2026-06-10',
              horasPrevistas: 100, horasRealizadas: 10 }),
      linha({ codigo: 2, fantasia: 'BETA', grupoEconomico: 'G2', tecnico: 'Bruno',
              statusRns: '3-Em Treinamento', dataContratacao: '2026-07-15',
              horasPrevistas: 100, horasRealizadas: 90 }),
    ];
    // O backend devolve agrupamentos do conjunto TODO — a tela não pode se basear neles.
    const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.porStatusVisivel()).toHaveLength(2);
    expect(comp.topTecnicos()).toHaveLength(2);

    comp.busca.set('ALFA');
    expect(comp.linhas()).toHaveLength(1);
    expect(comp.porStatusVisivel().map((a) => a.chave)).toEqual(['6-Concluída']);
    expect(comp.topTecnicos().map((a) => a.chave)).toEqual(['Ana']);
    expect(comp.graficoStatus()?.data.labels).toEqual(['6-Concluída']);
  });

  it('agrupa sem perder linhas com campo vazio', async () => {
    const linhas = [linha({ tecnico: '', grupoEconomico: '' })];
    const comp = await pronto({ resumo: () => Promise.resolve(resultado({ linhas })) });
    expect(comp.topTecnicos()).toEqual([
      expect.objectContaining({ chave: '(sem informação)', quantidade: 1 }),
    ]);
  });

  it('monta os gráficos a partir dos agrupamentos', async () => {
    const comp = await pronto({ resumo: () => Promise.resolve(resultado()) });
    expect(comp.graficoStatus()?.data.labels).toEqual(['6-Concluída']);
  });

  it('sem dados, não monta gráfico (evita canvas vazio)', async () => {
    const comp = await pronto({
      resumo: () => Promise.resolve(resultado({ linhas: [], porStatus: [] })),
    });
    expect(comp.graficoStatus()).toBeNull();
  });

  // ── Painel "Visitas do Portal Rech" (abaixo do CONTROLE DE HORAS) ──────────────────
  describe('visitas do Portal Rech', () => {
    /** Duas implantações (clientes 10-ALFA e 20-BETA) e três visitas: uma de cada + uma
     * de um cliente SEM implantação no período (99). */
    async function comVisitas() {
      const linhas = [
        linha({ codigo: 1, cliente: 10, fantasia: 'ALFA', grupoEconomico: 'G1' }),
        linha({ codigo: 2, cliente: 20, fantasia: 'BETA', grupoEconomico: 'G2' }),
      ];
      const visitas = [
        visita({ cliente: 10, empresa: 'ALFA', protocolo: 1, aprovado: 'Sim' }),
        visita({ cliente: 20, empresa: 'BETA', protocolo: 2, aprovado: 'Não' }),
        visita({ cliente: 99, empresa: 'GAMA', protocolo: 3 }),
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      // a busca das visitas roda DEPOIS do resumo — flush dos microtasks pendentes
      await Promise.resolve();
      await Promise.resolve();
      return comp;
    }

    it('mostra SÓ as visitas dos clientes visíveis na tabela (cliente filtrado sempre vale)', async () => {
      const comp = await comVisitas();
      // GAMA (cliente 99) não tem implantação no recorte → fica de fora
      expect(comp.visitasVisiveis().map((v) => v.protocolo)).toEqual([1, 2]);
      expect(comp.visitasAprovadas()).toBe(1);

      // a busca local corta a tabela para ALFA → o painel acompanha
      comp.busca.set('ALFA');
      expect(comp.visitasVisiveis().map((v) => v.protocolo)).toEqual([1]);
    });

    it('exibe ordenado por empresa → contato → consultor → data/hora (o SQL manda as mais recentes primeiro)', async () => {
      const linhas = [
        linha({ codigo: 1, cliente: 10, fantasia: 'ALFA', grupoEconomico: 'G1' }),
        linha({ codigo: 2, cliente: 20, fantasia: 'BETA', grupoEconomico: 'G2' }),
      ];
      // ordem de chegada = INICIO DESC (política de corte do teto), não a de exibição
      const visitas = [
        visita({ cliente: 20, empresa: 'BETA', protocolo: 3, data: '2026-08-15' }),
        visita({ cliente: 10, empresa: 'ALFA', protocolo: 2, data: '2026-08-14', horario: '14:00:00' }),
        visita({ cliente: 10, empresa: 'ALFA', protocolo: 1, data: '2026-08-14', horario: '08:00:00' }),
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(comp.visitasVisiveis().map((v) => v.protocolo)).toEqual([1, 2, 3]);
    });

    it('casa pelo nome fantasia quando a consulta editada não devolve o código', async () => {
      const linhas = [linha({ codigo: 1, cliente: 10, fantasia: 'ALFA' })];
      const visitas = [
        visita({ cliente: null, empresa: 'alfa', protocolo: 7 }),
        visita({ cliente: null, empresa: 'GAMA', protocolo: 8 }),
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(comp.visitasVisiveis().map((v) => v.protocolo)).toEqual([7]);
    });

    it('trocar um filtro local NÃO volta ao banco; o De/Até sim', async () => {
      const visitasPortal = vi.fn().mockResolvedValue(resultadoVisitas());
      const resumo = vi.fn().mockResolvedValue(resultado());
      const comp = await pronto({ resumo, visitasPortal });
      await Promise.resolve();
      expect(visitasPortal).toHaveBeenCalledTimes(1);

      // filtro local: mesmo período → nada de nova consulta
      comp.alternar(comp.statusSel, '6-Concluída');
      await Promise.resolve();
      await Promise.resolve();
      expect(visitasPortal).toHaveBeenCalledTimes(1);

      // período novo → reconsulta
      resumo.mockResolvedValue(
        resultado({ periodo: { inicio: '2026-01-01', fim: '2026-06-30' } }),
      );
      await comp.carregar();
      expect(visitasPortal).toHaveBeenCalledTimes(2);
      expect(visitasPortal).toHaveBeenLastCalledWith({
        dataIni: '2026-01-01',
        dataFim: '2026-06-30',
      });
    });

    it('erro do painel não derruba a tela (fica só no card de visitas)', async () => {
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado()),
        visitasPortal: () =>
          Promise.resolve(resultadoVisitas({ erro: 'ORA-00942: tabela ou view inexistente' })),
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(comp.erroVisitas()).toContain('ORA-00942');
      expect(comp.erro()).toBeNull();
      expect(comp.linhas()).toHaveLength(1);
    });

    it('identifica aprovação sem depender de caixa', async () => {
      const comp = await pronto({ resumo: () => Promise.resolve(resultado()) });
      expect(comp.aprovadoSim('Sim')).toBe(true);
      expect(comp.aprovadoSim('SIM')).toBe(true);
      expect(comp.aprovadoSim('Não')).toBe(false);
      expect(comp.aprovadoSim('')).toBe(false);
    });

    // ── Filtros locais, gráfico por contato e visões ─────────────────────────────────
    async function comFiltraveis() {
      const linhas = [linha({ codigo: 1, cliente: 10, fantasia: 'ALFA' })];
      const visitas = [
        visita({ cliente: 10, contato: 'Ana', consultor: 'Silva', protocolo: 1, aprovado: 'Sim' }),
        visita({ cliente: 10, contato: 'Ana', consultor: 'Rocha', protocolo: 2, aprovado: 'Não' }),
        visita({ cliente: 10, contato: 'Beto', consultor: 'Silva', protocolo: 3, aprovado: 'Sim' }),
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      await Promise.resolve();
      await Promise.resolve();
      return comp;
    }

    it('filtros do painel recortam tabela e contadores; as opções cascateiam', async () => {
      const comp = await comFiltraveis();

      comp.vpContato.set('Ana');
      // ordem de exibição: consultor Rocha < Silva dentro do mesmo contato
      expect(comp.visitasFiltradas().map((v) => v.protocolo)).toEqual([2, 1]);
      expect(comp.visitasAprovadas()).toBe(1);
      // a PRÓPRIA dimensão não se restringe (senão não daria para trocar a escolha)…
      expect(comp.opcoesVisitasContato()).toEqual(['Ana', 'Beto']);
      // …mas as demais encolhem para o recorte
      expect(comp.opcoesVisitasConsultor()).toEqual(['Rocha', 'Silva']);

      comp.vpConsultor.set('Rocha');
      expect(comp.visitasFiltradas().map((v) => v.protocolo)).toEqual([2]);
      expect(comp.opcoesVisitasContato()).toEqual(['Ana']);

      comp.limparFiltrosVisitas();
      expect(comp.visitasFiltradas()).toHaveLength(3);
    });

    it('filtro por nº de protocolo (contém)', async () => {
      const comp = await comFiltraveis();
      comp.vpProtocolo.set('3');
      expect(comp.visitasFiltradas().map((v) => v.protocolo)).toEqual([3]);
    });

    it('gráfico soma protocolos por contato (aprovados × não), mais volumosos primeiro', async () => {
      const linhas = [linha({ codigo: 1, cliente: 10, fantasia: 'ALFA' })];
      const visitas = [
        visita({ cliente: 10, contato: 'Ana', aprovado: 'Sim' }),
        visita({ cliente: 10, contato: 'Ana', aprovado: 'Não' }),
        visita({ cliente: 10, contato: 'Ana', aprovado: 'Sim' }),
        visita({ cliente: 10, contato: 'Beto', aprovado: 'Não' }),
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      await Promise.resolve();
      await Promise.resolve();

      const cfg = comp.graficoVisitasContato();
      expect(cfg?.data.labels).toEqual(['Ana', 'Beto']);
      expect(cfg?.data.datasets[0].data).toEqual([2, 0]); // aprovados
      expect(cfg?.data.datasets[1].data).toEqual([1, 1]); // não aprovados
    });

    it('visão mensal/semanal recorta o gráfico pela data de hoje (o filtro do painel também vale nele)', async () => {
      const linhas = [linha({ codigo: 1, cliente: 10, fantasia: 'ALFA' })];
      const visitas = [
        visita({ cliente: 10, contato: 'Ana', data: '2026-08-17' }), // semana E mês
        visita({ cliente: 10, contato: 'Ana', data: '2026-08-03' }), // só o mês
        visita({ cliente: 10, contato: 'Ana', data: '2026-07-10' }), // fora dos dois
      ];
      const comp = await pronto({
        resumo: () => Promise.resolve(resultado({ linhas })),
        visitasPortal: () => Promise.resolve(resultadoVisitas({ linhas: visitas })),
      });
      await Promise.resolve();
      await Promise.resolve();
      vi.spyOn(comp as unknown as { hojeLocal: () => string }, 'hojeLocal')
        .mockReturnValue('2026-08-17');

      const total = (): number => {
        const cfg = comp.graficoVisitasContato();
        return (cfg?.data.datasets ?? []).reduce(
          (a, d) => a + (d.data as number[]).reduce((x, y) => x + y, 0),
          0,
        );
      };
      expect(total()).toBe(3); // geral
      comp.visaoVisitas.set('mensal');
      expect(total()).toBe(2);
      comp.visaoVisitas.set('semanal'); // semana de segunda 17/08 a domingo 23/08
      expect(total()).toBe(1);
    });
  });
});
