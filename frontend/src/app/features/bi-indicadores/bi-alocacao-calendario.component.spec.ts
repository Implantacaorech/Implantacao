import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiAlocacaoCalendarioComponent } from './bi-alocacao-calendario.component';
import { BiAgendaAlocacaoService } from '../../core/services/bi-agenda-alocacao.service';
import {
  DiaAlocacaoBi,
  LinhaAlocacaoBi,
  ResultadoCalendarioAlocacaoBi,
} from '../../core/models/bi-agenda-alocacao.model';

function compromisso(over: Partial<LinhaAlocacaoBi> = {}): LinhaAlocacaoBi {
  return {
    codigo: 1,
    dia: '2026-07-06',
    horaIni: '09:00',
    horaFim: '11:30',
    status: '3-Agendada',
    assunto: 'Treinamento',
    minutos: 150,
    rns: 138571,
    especie: 92,
    especieDes: 'Atendimento Externo NÃO COBRADO',
    tecnico: 'Liliana',
    tipoSuporte: 'Implantação',
    fantasia: 'RAMADA',
    rnsDescricao: 'RAMADA - implantação',
    grupoEconomico: 'RAMADA',
    ...over,
  };
}

/** Julho/2026 começa numa quarta (diaSemana 3). */
function diasDeJulho(porDia: Record<number, LinhaAlocacaoBi[]> = {}): DiaAlocacaoBi[] {
  const dias: DiaAlocacaoBi[] = [];
  for (let d = 1; d <= 31; d++) {
    const iso = `2026-07-${String(d).padStart(2, '0')}`;
    dias.push({
      dia: iso,
      numero: d,
      diaSemana: new Date(`${iso}T00:00:00Z`).getUTCDay(),
      compromissos: porDia[d] ?? [],
    });
  }
  return dias;
}

function resultado(over: Partial<ResultadoCalendarioAlocacaoBi> = {}): ResultadoCalendarioAlocacaoBi {
  return {
    mes: '2026-07',
    dias: diasDeJulho({ 6: [compromisso()] }),
    resumo: [{ status: '3-Agendada', quantidade: 1, percentual: 100, cor: '#E0FFE0' }],
    totalCompromissos: 1,
    filtros: {
      grupos: ['RAMADA'],
      responsaveis: ['Liliana'],
      tiposSuporte: ['Implantação', 'Manutenção'],
      status: ['3-Agendada'],
    },
    selecionados: { grupos: [], responsaveis: [], tiposSuporte: [], status: [] },
    erro: null,
    ...over,
  };
}

describe('BiAlocacaoCalendarioComponent', () => {
  function montar(service: Partial<BiAgendaAlocacaoService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiAlocacaoCalendarioComponent],
      providers: [provideRouter([]), { provide: BiAgendaAlocacaoService, useValue: service }],
    });
    return TestBed.createComponent(BiAlocacaoCalendarioComponent);
  }

  async function pronto(service: Partial<BiAgendaAlocacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega o mês devolvido pelo backend', async () => {
    const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
    expect(comp.mes).toBe('2026-07');
    expect(comp.rotuloMes()).toBe('julho de 2026');
    expect(comp.totalVisivel()).toBe(1);
  });

  describe('grade do calendário', () => {
    it('alinha o dia 1 na coluna do dia da semana correto', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      const semanas = comp.semanas();
      expect(semanas[0].slice(0, 3)).toEqual([null, null, null]);
      expect(semanas[0][3]?.numero).toBe(1);
    });

    it('cobre os 31 dias do mês', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      const dias = comp.semanas().flat().filter(Boolean);
      expect(dias).toHaveLength(31);
    });

    it('mês sem dados não gera grade', async () => {
      const comp = await pronto({
        calendario: () => Promise.resolve(resultado({ dias: [], totalCompromissos: 0 })),
      });
      expect(comp.semanas()).toEqual([]);
    });
  });

  it('conta compromissos DISTINTOS por código — 2 técnicos no mesmo compromisso não dobram o total', async () => {
    const dias = diasDeJulho({
      6: [
        compromisso({ codigo: 10, tecnico: 'Alex' }),
        compromisso({ codigo: 10, tecnico: 'Clovis' }),
      ],
    });
    const comp = await pronto({
      calendario: () => Promise.resolve(resultado({ dias, totalCompromissos: 1 })),
    });
    expect(comp.totalVisivel()).toBe(1);
    expect(comp.tecnicosVisiveis()).toBe(2);
  });

  describe('navegação de mês', () => {
    it('avança e volta', async () => {
      const calendario = vi.fn().mockImplementation((f) =>
        Promise.resolve(resultado({ mes: f?.mes ?? '2026-07' })),
      );
      const comp = await pronto({ calendario });

      await comp.navegarMes(1);
      expect(comp.mes).toBe('2026-08');
      await comp.navegarMes(-1);
      expect(comp.mes).toBe('2026-07');
    });
  });

  it('a busca local filtra dentro dos dias e recalcula o resumo', async () => {
    const dias = diasDeJulho({
      6: [compromisso({ codigo: 1, fantasia: 'ALFA', status: '3-Agendada' })],
      7: [compromisso({ codigo: 2, dia: '2026-07-07', fantasia: 'BETA', status: '6-Realizada' })],
    });
    const comp = await pronto({
      calendario: () => Promise.resolve(resultado({ dias, totalCompromissos: 2 })),
    });
    expect(comp.totalVisivel()).toBe(2);

    comp.busca.set('ALFA');
    expect(comp.totalVisivel()).toBe(1);
    expect(comp.resumo().map((r) => r.status)).toEqual(['3-Agendada']);
  });

  it('a busca encontra pelo nome do técnico', async () => {
    const dias = diasDeJulho({
      6: [compromisso({ codigo: 1, tecnico: 'Liliana' })],
      7: [compromisso({ codigo: 2, dia: '2026-07-07', tecnico: 'Zeca' })],
    });
    const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });
    comp.busca.set('zeca');
    expect(comp.compromissosVisiveis().map((c) => c.codigo)).toEqual([2]);
  });

  it('compromisso sem RNS ligada não quebra a busca nem o card', async () => {
    const dias = diasDeJulho({
      6: [compromisso({ codigo: 1, rns: null, fantasia: '', rnsDescricao: '' })],
    });
    const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });
    expect(comp.compromissosVisiveis()[0].rns).toBeNull();
  });

  it('abrir e fechar o detalhe do dia', async () => {
    const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
    const dia = comp.dias().find((d) => d.dia === '2026-07-06')!;

    comp.abrirDia(dia);
    expect(comp.diaAberto()).toBe('2026-07-06');
    expect(comp.detalheDoDia()?.compromissos).toHaveLength(1);

    comp.abrirDia(dia);
    expect(comp.diaAberto()).toBeNull();
  });

  it('dia sem compromisso não abre detalhe', async () => {
    const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
    const vazio = comp.dias().find((d) => d.compromissos.length === 0)!;
    comp.abrirDia(vazio);
    expect(comp.diaAberto()).toBeNull();
  });

  it('manda os filtros compartilhados ao backend (técnico = store.responsavel)', async () => {
    const calendario = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ calendario });
    calendario.mockClear();

    comp.alternar(comp.tecnicosSel, 'Liliana');
    await Promise.resolve();
    expect(calendario).toHaveBeenCalledWith(expect.objectContaining({ responsavel: ['Liliana'] }));
  });

  it('limpar tira o status do compromisso (filtro local desta tela)', async () => {
    const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
    comp.statusSel.set(['3-Agendada']);
    await comp.limparFiltros();
    expect(comp.statusSel()).toEqual([]);
  });

  describe('visão por técnico (mapa de calor)', () => {
    it('nasce na visão por técnico', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      expect(comp.visao()).toBe('tecnico');
    });

    it('agrupa por técnico e soma horas, turnos e compromissos distintos', async () => {
      const dias = diasDeJulho({
        6: [
          compromisso({ codigo: 1, tecnico: 'Liliana', minutos: 150 }),
          compromisso({ codigo: 1, tecnico: 'Zeca', minutos: 150 }),
        ],
        7: [compromisso({ codigo: 2, dia: '2026-07-07', tecnico: 'Liliana', minutos: 90 })],
      });
      const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });

      expect(comp.tecnicos().map((t) => t.nome)).toEqual(['Liliana', 'Zeca']);
      const liliana = comp.tecnicos()[0];
      expect(liliana.horas).toBe(4); // 150 + 90 min
      expect(liliana.compromissos).toBe(2);
      expect(liliana.turnosOcupados).toBe(2);
      expect(liliana.turnosUteis).toBe(46); // 23 dias úteis em julho/2026 × 2
    });

    it('o compromisso entra no turno em que COMEÇA — 07:45–17:45 é manhã', async () => {
      const dias = diasDeJulho({
        6: [
          compromisso({ codigo: 1, horaIni: '07:45', horaFim: '17:45', minutos: 600 }),
          compromisso({ codigo: 2, horaIni: '13:30', horaFim: '16:00', minutos: 150 }),
        ],
      });
      const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });
      const dia = comp.tecnicos()[0].dias.find((d) => d.dia === '2026-07-06')!;

      expect(dia.manha.compromissos.map((c) => c.codigo)).toEqual([1]);
      expect(dia.tarde.compromissos.map((c) => c.codigo)).toEqual([2]);
      expect(dia.manha.carga).toBe(3); // acima de 4h
      expect(dia.tarde.carga).toBe(2); // entre 2h e 4h
    });

    it('a régua traz os dias úteis mais os fins de semana COM agenda', async () => {
      const dias = diasDeJulho({ 4: [compromisso({ dia: '2026-07-04' })] }); // sábado
      const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });
      const numeros = comp.diasMapa().map((d) => d.numero);

      expect(numeros).toContain(4); // sábado com agenda entra
      expect(numeros).not.toContain(5); // domingo vazio fica de fora
      expect(numeros).toHaveLength(24); // 23 úteis + o sábado
    });

    it('abre e fecha o turno; turno livre não abre', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      const dia = comp.tecnicos()[0].dias.find((d) => d.dia === '2026-07-06')!;

      comp.abrirTurno(dia.manha);
      expect(comp.detalheTurno()?.compromissos).toHaveLength(1);
      expect(comp.tecnicoAberto()).toBe('Liliana');

      comp.abrirTurno(dia.manha);
      expect(comp.detalheTurno()).toBeNull();

      comp.abrirTurno(dia.tarde); // livre
      expect(comp.turnoAberto()).toBeNull();
    });

    it('clicar no técnico abre o primeiro turno ocupado dele', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      comp.abrirTecnico(comp.tecnicos()[0]);
      expect(comp.turnoAberto()).toEqual({
        tecnico: 'Liliana',
        dia: '2026-07-06',
        turno: 'manha',
      });
    });

    it('filtro que esvazia o turno aberto zera o painel da direita', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      comp.abrirTurno(comp.tecnicos()[0].dias.find((d) => d.dia === '2026-07-06')!.manha);
      expect(comp.detalheTurno()).not.toBeNull();

      comp.busca.set('não existe');
      expect(comp.detalheTurno()).toBeNull();
      expect(comp.tecnicos()).toEqual([]);
    });

    it('criticidade sai da duração do compromisso', async () => {
      const comp = await pronto({ calendario: () => Promise.resolve(resultado()) });
      expect(comp.criticidade(50)).toBe('NORMAL');
      expect(comp.criticidade(75)).toBe('MÉDIO');
      expect(comp.criticidade(120)).toBe('ALTO');
      expect(comp.criticidade(240)).toBe('CRÍTICO');
      expect(comp.duracao(150)).toBe('2h 30m');
      expect(comp.duracao(120)).toBe('2h');
      expect(comp.duracao(50)).toBe('50m');
    });

    it('compromisso sem técnico não some da equipe', async () => {
      const dias = diasDeJulho({ 6: [compromisso({ tecnico: '' })] });
      const comp = await pronto({ calendario: () => Promise.resolve(resultado({ dias })) });
      expect(comp.tecnicos().map((t) => t.nome)).toEqual(['Não informado']);
      expect(comp.tecnicos()[0].inicial).toBe('N');
    });
  });

  it('mostra erro do backend sem quebrar', async () => {
    const comp = await pronto({
      calendario: () => Promise.resolve(resultado({ erro: 'ORA-00942', dias: [] })),
    });
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.semanas()).toEqual([]);
  });
});
