import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AgendaCalendarioComponent } from './agenda-calendario.component';
import { AgendaCalendarioService } from '../../core/services/agenda-calendario.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CompromissoAgenda,
  DiaAgenda,
  ResultadoAgendaCalendario,
  UsuarioAgenda,
} from '../../core/models/agenda-calendario.model';

function compromisso(over: Partial<CompromissoAgenda> = {}): CompromissoAgenda {
  return {
    codigo: 1,
    dia: '2026-08-12',
    horaIni: '09:00',
    horaFim: '11:30',
    status: '3-Agendada',
    assunto: 'Treinamento',
    minutos: 150,
    rns: 138571,
    especie: 92,
    especieDes: 'Atendimento Externo',
    tecnico: 'LILIANA CORTES',
    tipoSuporte: 'Implantação',
    fantasia: 'RAMADA',
    rnsDescricao: 'RAMADA - implantação',
    grupoEconomico: 'RAMADA',
    ...over,
  };
}

/** Tabela `usuarios` do Painel — a fonte do filtro de técnicos. A grafia é a do SICLA
 * (caixa alta, sem acento), diferente da do login de propósito: a carga inicial tem de
 * resolver o usuário logado NESTA lista. */
const TABELA_USUARIOS: UsuarioAgenda[] = [
  { id: 1, nome: 'LILIANA CORTES' },
  { id: 2, nome: 'Alex Ramos' },
  { id: 3, nome: 'Bruna Prado' },
];

/** Monta a resposta do backend para a janela [ini, fim]: um item POR DIA, como o serviço
 * real devolve, distribuindo as linhas pelo `dia` de cada uma. */
function resultadoPara(
  ini: string,
  fim: string,
  linhas: CompromissoAgenda[],
  erro: string | null = null,
): ResultadoAgendaCalendario {
  const dias: DiaAgenda[] = [];
  for (
    let d = new Date(`${ini}T00:00:00Z`);
    d.toISOString().slice(0, 10) <= fim;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const iso = d.toISOString().slice(0, 10);
    dias.push({
      dia: iso,
      numero: d.getUTCDate(),
      diaSemana: d.getUTCDay(),
      compromissos: linhas.filter((c) => c.dia === iso),
    });
  }
  return {
    ini,
    fim,
    dias,
    responsaveis: [...new Set(linhas.map((c) => c.tecnico))].sort(),
    resumo: [...new Set(linhas.map((c) => c.status))].map((status) => ({
      status,
      quantidade: linhas.filter((c) => c.status === status).length,
      percentual: 100,
      cor: '#E0FFE0',
    })),
    totalCompromissos: new Set(linhas.map((c) => c.codigo)).size,
    erro,
  };
}

function fakeService(linhas: CompromissoAgenda[], erro: string | null = null) {
  const chamadas: { ini?: string; fim?: string }[] = [];
  return {
    chamadas,
    usuarios: () => Promise.resolve(TABELA_USUARIOS),
    calendario: (ini?: string, fim?: string) => {
      chamadas.push({ ini, fim });
      return Promise.resolve(
        resultadoPara(ini ?? '2026-08-09', fim ?? '2026-08-15', linhas, erro),
      );
    },
  };
}

/** Usuária logada com ACENTO no cadastro do Painel — a tabela grava sem acento; a carga
 * inicial tem de casar mesmo assim e adotar a grafia da tabela. */
const AUTH_FAKE = {
  usuario: signal({
    sub: 7,
    login: 'liliana@rech.com.br',
    nome: 'Liliana Côrtes',
    perfil: 'Consultor' as const,
    codigoSicla: '42',
  }),
};

describe('AgendaCalendarioComponent (Execução → Agenda)', () => {
  function montar(service: ReturnType<typeof fakeService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AgendaCalendarioComponent],
      providers: [
        { provide: AgendaCalendarioService, useValue: service },
        { provide: AuthService, useValue: AUTH_FAKE },
      ],
    });
    return TestBed.createComponent(AgendaCalendarioComponent);
  }

  async function pronto(service: ReturnType<typeof fakeService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  /** Fixa a semana de 09–15/08/2026 (quarta 12/08 como âncora) para o teste ser estável. */
  async function naSemanaFixa(service: ReturnType<typeof fakeService>) {
    const comp = await pronto(service);
    comp.referencia.set('2026-08-12');
    await comp.carregar();
    return comp;
  }

  it('abre em visão SEMANAL, domingo→sábado, contendo o dia de hoje', async () => {
    const svc = fakeService([]);
    const comp = await pronto(svc);
    expect(comp.visao()).toBe('semana');
    const { ini, fim } = svc.chamadas[0];
    expect(new Date(`${ini}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(new Date(`${fim}T00:00:00Z`).getUTCDay()).toBe(6);
    expect(ini! <= comp.referencia() && comp.referencia() <= fim!).toBe(true);
  });

  it('carga inicial: seleciona o usuário logado RESOLVIDO na tabela de usuários', async () => {
    const svc = fakeService([
      compromisso({ codigo: 1, tecnico: 'LILIANA CORTES' }),
      compromisso({ codigo: 2, tecnico: 'Alex Ramos' }),
    ]);
    const comp = await naSemanaFixa(svc);
    // 'Liliana Côrtes' (login) casou com 'LILIANA CORTES' (tabela) — e é a grafia da
    // TABELA que fica no filtro, porque é a que bate com o TECNICO do SICLA.
    expect(comp.responsaveisSel()).toEqual(['LILIANA CORTES']);
    expect(comp.minhasAgendas()).toBe(true);
    expect(comp.compromissosVisiveis().map((c) => c.tecnico)).toEqual([
      'LILIANA CORTES',
    ]);
  });

  it('o filtro de técnicos nasce da TABELA de usuários, não só de quem tem agenda', async () => {
    const svc = fakeService([compromisso({ tecnico: 'LILIANA CORTES' })]);
    const comp = await naSemanaFixa(svc);
    // Bruna não tem compromisso no período e mesmo assim está no filtro.
    expect(comp.usuariosVisiveis().map((u) => u.nome)).toEqual([
      'LILIANA CORTES',
      'Alex Ramos',
      'Bruna Prado',
    ]);
    comp.buscaTecnico.set('bruna');
    expect(comp.usuariosVisiveis().map((u) => u.nome)).toEqual(['Bruna Prado']);
  });

  it('"Todas" limpa a seleção e mostra a equipe inteira; escolher um técnico refiltra', async () => {
    const svc = fakeService([
      compromisso({ codigo: 1, tecnico: 'LILIANA CORTES' }),
      compromisso({ codigo: 2, tecnico: 'Alex Ramos' }),
    ]);
    const comp = await naSemanaFixa(svc);
    const chamadasAntes = svc.chamadas.length;

    comp.verTodas();
    expect(comp.responsaveisSel()).toEqual([]);
    expect(comp.totalVisivel()).toBe(2);
    expect(comp.tecnicosVisiveis()).toBe(2);

    comp.alternar(comp.responsaveisSel, 'Alex Ramos');
    expect(comp.compromissosVisiveis().map((c) => c.tecnico)).toEqual([
      'Alex Ramos',
    ]);
    // Filtros são em memória: nenhuma ida nova ao backend.
    expect(svc.chamadas.length).toBe(chamadasAntes);

    comp.verMinhas();
    expect(comp.responsaveisSel()).toEqual(['LILIANA CORTES']);
  });

  it('navegar(1) na semana avança 7 dias e recarrega a janela nova', async () => {
    const svc = fakeService([]);
    const comp = await naSemanaFixa(svc);
    await comp.navegar(1);
    expect(svc.chamadas.at(-1)).toEqual({ ini: '2026-08-16', fim: '2026-08-22' });
  });

  it('visão MENSAL pede o mês fechado e alinha o dia 1 na coluna certa', async () => {
    const svc = fakeService([]);
    const comp = await naSemanaFixa(svc);
    await comp.definirVisao('mes');
    expect(svc.chamadas.at(-1)).toEqual({ ini: '2026-08-01', fim: '2026-08-31' });
    const semanas = comp.semanasMes();
    // 01/08/2026 é sábado — seis células vazias antes dele.
    expect(semanas[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(semanas[0][6]?.numero).toBe(1);
    expect(semanas.flat().filter(Boolean)).toHaveLength(31);
  });

  it('visão DIÁRIA pede e mostra só o dia de referência', async () => {
    const svc = fakeService([compromisso()]);
    const comp = await naSemanaFixa(svc);
    await comp.definirVisao('dia');
    expect(svc.chamadas.at(-1)).toEqual({ ini: '2026-08-12', fim: '2026-08-12' });
    expect(comp.diaDetalhe()?.dia).toBe('2026-08-12');
    expect(comp.diaDetalhe()?.compromissos).toHaveLength(1);
  });

  it('status e busca refinam em memória, sobre o que já está na tela', async () => {
    const svc = fakeService([
      compromisso({ codigo: 1, status: '3-Agendada', fantasia: 'RAMADA' }),
      // grupoEconomico também sobrescrito: a busca olha o grupo, e o molde traz 'RAMADA'.
      compromisso({
        codigo: 2,
        status: '6-Realizada',
        fantasia: 'WLG',
        grupoEconomico: 'WLG',
      }),
    ]);
    const comp = await naSemanaFixa(svc);
    comp.verTodas();

    comp.alternar(comp.statusSel, '6-Realizada');
    expect(comp.compromissosVisiveis().map((c) => c.codigo)).toEqual([2]);

    comp.limparFiltros();
    comp.busca.set('ramada');
    expect(comp.compromissosVisiveis().map((c) => c.codigo)).toEqual([1]);
  });

  it('erro vindo do backend aparece na tela sem derrubar o componente', async () => {
    const svc = fakeService([], 'Conexão com o SICLA não configurada ou inativa.');
    const comp = await pronto(svc);
    expect(comp.erro()).toContain('SICLA');
    expect(comp.compromissosVisiveis()).toEqual([]);
  });
});
