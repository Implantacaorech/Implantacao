import { TestBed } from '@angular/core/testing';
import { RnsComponent } from './rns.component';
import { RnsService } from '../../core/services/rns.service';
import { PreferenciasService } from '../../core/services/preferencias.service';
import { LinhaRns, ResultadoConsultaRns } from '../../core/models/rns.model';

/** Fake do serviço de preferências (o `filtrosSalvos` do construtor o injeta): nada salvo,
 * gravação é no-op — o teste fica hermético, sem HttpClient. */
const PREFS_FAKE = {
  carregadas: true,
  garantirCarregado: () => Promise.resolve(),
  ler: () => null,
  salvar: () => undefined,
  descartar: () => Promise.resolve(),
};

function linha(over: Partial<LinhaRns> = {}): LinhaRns {
  return {
    pedido: 138643,
    item: 1,
    codigo: 141234,
    cliente: 5001,
    status: '3',
    sugestao: 'Conversão de histórico de vendas',
    tipo: '6',
    subtipo: '',
    projeto: '',
    prioridadeA: '',
    prioridade: 12,
    prioridadeAna: '',
    disponivel: 'N',
    temReq: 'S',
    tipoDes: '6-Conversão',
    statusDes: '3-Aprovada',
    statusPubDes: '',
    backlogDes: 'Backlog Implantação',
    faseDes: '',
    requisitoDes: '',
    dataCri: '2026-08-01',
    dataDesejada: '',
    dataPrevista: '2026-09-30',
    dataPrevFimProd: '',
    dataStatus8: '',
    dataStatus10: '',
    diasTriagem: 4,
    resNome: 'Liliana',
    sigla: 'CNV',
    fantasia: 'WLG Distribuidora',
    visaoGeral: 'Converter o histórico de vendas',
    contato: '',
    versaoAtu: '',
    versaoLib: '',
    minVerGeracao: '',
    anaNome: 'Giomar',
    valCoordenadorDes: '',
    valTecnicoDes: '',
    valGrupoDes: '',
    funcaoDes: '',
    represenDes: '',
    productOwnerDes: '',
    celula: '',
    menu: '',
    turnosPrev: null,
    timeDes: '',
    pontos: null,
    protocolo: '',
    rnsFilhas: '',
    valorCob: 1500.5,
    ...over,
  };
}

function resultado(
  itens: LinhaRns[],
  erro: string | null = null,
  truncado = false,
): ResultadoConsultaRns {
  return {
    ini: '2026-07-01',
    fim: '2026-09-30',
    itens,
    total: itens.length,
    limite: 5000,
    truncado,
    erro,
  };
}

function fakeService(itens: LinhaRns[], erro: string | null = null) {
  const chamadas: { ini?: string; fim?: string }[] = [];
  return {
    chamadas,
    consultar: (ini?: string, fim?: string) => {
      chamadas.push({ ini, fim });
      return Promise.resolve(resultado(itens, erro));
    },
  };
}

describe('RnsComponent (Execução → RNS)', () => {
  function montar(service: ReturnType<typeof fakeService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [RnsComponent],
      providers: [
        { provide: RnsService, useValue: service },
        { provide: PreferenciasService, useValue: PREFS_FAKE },
      ],
    });
    return TestBed.createComponent(RnsComponent);
  }

  async function pronto(service: ReturnType<typeof fakeService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('abre consultando o período default e assume a janela efetiva do backend', async () => {
    const svc = fakeService([linha()]);
    const comp = await pronto(svc);
    // 1ª chamada sem datas: quem decide o default é o backend.
    expect(svc.chamadas[0]).toEqual({ ini: undefined, fim: undefined });
    expect(comp.ini()).toBe('2026-07-01');
    expect(comp.fim()).toBe('2026-09-30');
    expect(comp.visiveis()).toHaveLength(1);
  });

  it('a busca por assunto casa SEM acento/caixa e filtra em memória', async () => {
    // A 2ª linha zera também tipoDes/visaoGeral do molde — senão o "6-Conversão" herdado
    // faria a busca achá-la de verdade (a busca olha TODOS os campos).
    const svc = fakeService([
      linha({ pedido: 1, sugestao: 'Conversão de histórico de vendas' }),
      linha({
        pedido: 2,
        sugestao: 'Comissão por representante',
        fantasia: 'RAMADA',
        tipoDes: '5-Implementação',
        visaoGeral: 'Comissão dos representantes',
      }),
    ]);
    const comp = await pronto(svc);
    const chamadasAntes = svc.chamadas.length;

    comp.busca.set('conversao');
    expect(comp.visiveis().map((l) => l.pedido)).toEqual([1]);
    // Filtro é em memória: nenhuma ida nova ao backend.
    expect(svc.chamadas.length).toBe(chamadasAntes);
  });

  it('vários termos exigem TODOS presentes (busca "e", não "ou")', async () => {
    const svc = fakeService([
      linha({ pedido: 1, sugestao: 'Conversão de produtos', fantasia: 'RAMADA' }),
      linha({ pedido: 2, sugestao: 'Conversão de clientes', fantasia: 'WLG' }),
    ]);
    const comp = await pronto(svc);
    comp.busca.set('conversao ramada');
    expect(comp.visiveis().map((l) => l.pedido)).toEqual([1]);
  });

  it('acha a RNS pelo número do pedido', async () => {
    const svc = fakeService([linha({ pedido: 138643 }), linha({ pedido: 999, item: 2 })]);
    const comp = await pronto(svc);
    comp.busca.set('138643');
    expect(comp.visiveis().map((l) => l.pedido)).toEqual([138643]);
  });

  it('filtros de status e tipo refinam junto com a busca', async () => {
    const svc = fakeService([
      linha({ pedido: 1, statusDes: '3-Aprovada', tipoDes: '6-Conversão' }),
      linha({ pedido: 2, statusDes: '10-Entregue', tipoDes: '6-Conversão' }),
      linha({ pedido: 3, statusDes: '3-Aprovada', tipoDes: '5-Implementação' }),
    ]);
    const comp = await pronto(svc);
    expect(comp.statusOpcoes()).toEqual(['10-Entregue', '3-Aprovada']);

    comp.statusSel.set('3-Aprovada');
    expect(comp.visiveis().map((l) => l.pedido)).toEqual([1, 3]);

    comp.tipoSel.set('6-Conversão');
    expect(comp.visiveis().map((l) => l.pedido)).toEqual([1]);

    comp.limparFiltros();
    expect(comp.visiveis()).toHaveLength(3);
  });

  it('mudar o período recarrega do backend com as datas novas', async () => {
    const svc = fakeService([]);
    const comp = await pronto(svc);
    await comp.definirPeriodo('ini', '2026-01-01');
    expect(svc.chamadas.at(-1)).toEqual({ ini: '2026-01-01', fim: '2026-09-30' });
  });

  it('clique na linha abre o detalhe; clicar de novo fecha', async () => {
    const svc = fakeService([linha()]);
    const comp = await pronto(svc);
    const l = comp.visiveis()[0];
    comp.alternarDetalhe(l);
    expect(comp.estaAberta(l)).toBe(true);
    comp.alternarDetalhe(l);
    expect(comp.estaAberta(l)).toBe(false);
  });

  it('erro vindo do backend aparece na tela sem derrubar o componente', async () => {
    const svc = fakeService([], 'Conexão com o SICLA não configurada ou inativa.');
    const comp = await pronto(svc);
    expect(comp.erro()).toContain('SICLA');
    expect(comp.visiveis()).toEqual([]);
  });
});
