import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BiAgendasComponent } from './bi-agendas.component';
import { BiImplantacaoService } from '../../core/services/bi-implantacao.service';
import {
  DiaAgendaBi,
  LinhaAgendaBi,
  ResultadoAgendasBi,
} from '../../core/models/bi-implantacao.model';

function agenda(over: Partial<LinhaAgendaBi> = {}): LinhaAgendaBi {
  return {
    codigo: 1,
    rnsImplantacao: 138571,
    dia: '2026-07-06',
    horaIni: '09:00',
    horaFim: '11:30',
    status: '3-Agendada',
    statusOriginal: '3-Agendada',
    especie: 92,
    especieDes: 'Atendimento Externo NÃO COBRADO',
    participantes: ['Liliana', 'Medeiros'],
    responsavel: 'Paim',
    cliente: 3627,
    clienteFantasia: 'RAMADA',
    assunto: 'Treinamento',
    horasDuracao: 2.5,
    observacao: '',
    turno: 'Manhã',
    statusImplantacao: '3-Em Treinamento',
    tecnicoImplantacao: 'Paim',
    descricaoImplantacao: 'RAMADA - implantação',
    grupoEconomico: 'RAMADA',
    ...over,
  };
}

/** Julho/2026 começa numa quarta (diaSemana 3). */
function diasDeJulho(agendasPorDia: Record<number, LinhaAgendaBi[]> = {}): DiaAgendaBi[] {
  const dias: DiaAgendaBi[] = [];
  for (let d = 1; d <= 31; d++) {
    const iso = `2026-07-${String(d).padStart(2, '0')}`;
    const ag = agendasPorDia[d] ?? [];
    dias.push({
      dia: iso,
      numero: d,
      diaSemana: new Date(`${iso}T00:00:00Z`).getUTCDay(),
      agendas: ag,
      totalNoDia: ag.length,
    });
  }
  return dias;
}

function resultado(over: Partial<ResultadoAgendasBi> = {}): ResultadoAgendasBi {
  return {
    mes: '2026-07',
    dias: diasDeJulho({ 6: [agenda()] }),
    resumo: [{ status: '3-Agendada', quantidade: 1, percentual: 100, cor: '#E0FFE0' }],
    totalAgendas: 1,
    filtros: {
      grupos: ['RAMADA'],
      tecnicos: ['Liliana', 'Medeiros'],
      statusImplantacao: ['3-Em Treinamento'],
      status: ['3-Agendada'],
      rns: [{ codigo: '138571', rotulo: '138571 — RAMADA' }],
    },
    selecionados: { grupos: [], tecnicos: [], statusImplantacao: [], status: [], rns: [] },
    erro: null,
    ...over,
  };
}

describe('BiAgendasComponent', () => {
  function montar(service: Partial<BiImplantacaoService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BiAgendasComponent],
      providers: [provideRouter([]), { provide: BiImplantacaoService, useValue: service }],
    });
    return TestBed.createComponent(BiAgendasComponent);
  }

  async function pronto(service: Partial<BiImplantacaoService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carrega o mês devolvido pelo backend', async () => {
    const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
    expect(comp.mes).toBe('2026-07');
    expect(comp.rotuloMes()).toBe('julho de 2026');
    expect(comp.totalVisivel()).toBe(1);
  });

  describe('grade do calendário', () => {
    it('alinha o dia 1 na coluna do dia da semana correto', async () => {
      const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
      const semanas = comp.semanas();
      // julho/2026 começa numa QUARTA: 3 células vazias antes do dia 1
      expect(semanas[0].slice(0, 3)).toEqual([null, null, null]);
      expect(semanas[0][3]?.numero).toBe(1);
    });

    it('toda semana tem exatamente 7 células', async () => {
      const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
      for (const s of comp.semanas()) expect(s).toHaveLength(7);
    });

    it('cobre os 31 dias do mês', async () => {
      const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
      const dias = comp.semanas().flat().filter(Boolean);
      expect(dias).toHaveLength(31);
    });

    it('mês sem dados não gera grade', async () => {
      const comp = await pronto({
        agendas: () => Promise.resolve(resultado({ dias: [], totalAgendas: 0 })),
      });
      expect(comp.semanas()).toEqual([]);
    });
  });

  describe('navegação de mês', () => {
    it('avança e volta', async () => {
      const agendas = vi.fn().mockImplementation((f) =>
        Promise.resolve(resultado({ mes: f?.mes ?? '2026-07' })),
      );
      const comp = await pronto({ agendas });

      await comp.navegarMes(1);
      expect(comp.mes).toBe('2026-08');
      await comp.navegarMes(-1);
      expect(comp.mes).toBe('2026-07');
    });

    it('vira o ano em dezembro e em janeiro', async () => {
      const agendas = vi.fn().mockImplementation((f) =>
        Promise.resolve(resultado({ mes: f?.mes ?? '2026-12' })),
      );
      const comp = await pronto({ agendas });

      comp.mes = '2026-12';
      await comp.navegarMes(1);
      expect(comp.mes).toBe('2027-01');

      comp.mes = '2026-01';
      await comp.navegarMes(-1);
      expect(comp.mes).toBe('2025-12');
    });
  });

  it('a busca local filtra dentro dos dias e recalcula o resumo', async () => {
    const dias = diasDeJulho({
      6: [agenda({ codigo: 1, clienteFantasia: 'ALFA', status: '3-Agendada' })],
      7: [agenda({ codigo: 2, dia: '2026-07-07', clienteFantasia: 'BETA', status: '6-Realizada' })],
    });
    const comp = await pronto({
      agendas: () => Promise.resolve(resultado({ dias, totalAgendas: 2 })),
    });
    expect(comp.totalVisivel()).toBe(2);

    comp.busca.set('ALFA');
    expect(comp.totalVisivel()).toBe(1);
    expect(comp.resumo().map((r) => r.status)).toEqual(['3-Agendada']);
    expect(comp.resumo()[0].percentual).toBe(100);
  });

  it('a busca encontra pelo nome do participante', async () => {
    const dias = diasDeJulho({
      6: [agenda({ codigo: 1, participantes: ['Liliana'] })],
      7: [agenda({ codigo: 2, dia: '2026-07-07', participantes: ['Zeca'] })],
    });
    const comp = await pronto({ agendas: () => Promise.resolve(resultado({ dias })) });
    comp.busca.set('zeca');
    expect(comp.agendasVisiveis().map((a) => a.codigo)).toEqual([2]);
  });

  it('soma horas e conta consultores distintos do que está visível', async () => {
    const dias = diasDeJulho({
      6: [agenda({ codigo: 1, horasDuracao: 2.5, participantes: ['Ana', 'Bruno'] })],
      7: [agenda({ codigo: 2, dia: '2026-07-07', horasDuracao: 1.5, participantes: ['Ana'] })],
    });
    const comp = await pronto({ agendas: () => Promise.resolve(resultado({ dias })) });
    expect(comp.horasVisiveis()).toBe(4);
    expect(comp.consultoresVisiveis()).toBe(2); // Ana conta uma vez
  });

  it('abrir e fechar o detalhe do dia', async () => {
    const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
    const dia = comp.dias().find((d) => d.dia === '2026-07-06')!;

    comp.abrirDia(dia);
    expect(comp.diaAberto()).toBe('2026-07-06');
    expect(comp.detalheDoDia()?.agendas).toHaveLength(1);

    comp.abrirDia(dia);
    expect(comp.diaAberto()).toBeNull();
  });

  it('dia sem agenda não abre detalhe', async () => {
    const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
    const vazio = comp.dias().find((d) => d.agendas.length === 0)!;
    comp.abrirDia(vazio);
    expect(comp.diaAberto()).toBeNull();
  });

  it('encurta o rótulo do status para exibição', async () => {
    const comp = await pronto({ agendas: () => Promise.resolve(resultado()) });
    expect(comp.rotuloStatus('7-Não realizada')).toBe('Não realizada');
    expect(comp.rotuloStatus('6-Realizada')).toBe('Realizada');
    expect(comp.rotuloStatus('sem prefixo')).toBe('sem prefixo');
  });

  it('manda os filtros compartilhados ao backend', async () => {
    const agendas = vi.fn().mockResolvedValue(resultado());
    const comp = await pronto({ agendas });
    agendas.mockClear();

    comp.alternar(comp.tecnicosSel, 'Liliana');
    await Promise.resolve();
    expect(agendas).toHaveBeenCalledWith(expect.objectContaining({ tecnico: ['Liliana'] }));
  });

  it('mostra erro do backend sem quebrar', async () => {
    const comp = await pronto({
      agendas: () => Promise.resolve(resultado({ erro: 'ORA-00942', dias: [] })),
    });
    expect(comp.erro()).toContain('ORA-00942');
    expect(comp.semanas()).toEqual([]);
  });
});
