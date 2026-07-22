import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PassosComponent } from './passos.component';
import { PassosService } from '../../core/services/passos.service';
import { ProjetosService } from '../../core/services/projetos.service';
import { DesignacaoService } from '../../core/services/designacao.service';
import { Passo } from '../../core/models/passo.model';
import { Projeto } from '../../core/models/projeto.model';

function projeto(): Projeto {
  return {
    id: 5,
    cliente: 'Cliente Teste',
    cnpj: '',
    numeroProjeto: '',
    numeroProposta: '',
    ramo: '',
    responsavel: '',
    consultor: '',
    gci: '',
    etapa: 'Agendamento',
    situacao: 'Em andamento',
    dataInicio: '',
    dataLevantamento: '',
    dataUsoOficial: '',
    dataEncerramento: '',
    horasCobradas: '',
    horasBonificadas: '',
    modulos: '',
    contatoNome: '',
    contatoEmail: '',
    contatoTel: '',
    contatos: '',
    observacoes: '',
    criadoEm: '',
    atualizadoEm: '',
  };
}

function passo(over: Partial<Passo> = {}): Passo {
  return {
    numero: 1,
    titulo: 'Passo',
    etapa: 'Agendamento',
    responsavel: 'Administrativo',
    depende: [],
    irreversivel: false,
    concluido: false,
    concluidoEm: null,
    concluidoPor: '',
    conferido: false,
    bloqueadoPor: [],
    liberado: true,
    motivos: [],
    ...over,
  };
}

describe('PassosComponent', () => {
  let servicoFake: {
    listar: () => Promise<Passo[]>;
    listarRns: () => Promise<[]>;
    pessoas: () => Promise<{ levantadores: []; consultores: [] }>;
    definirPessoas: () => Promise<[]>;
    pessoasPorPapel: (papel: string) => Promise<string[]>;
    concluir: (id: number, numero: number) => Promise<Passo[]>;
    conferir: () => Promise<Passo[]>;
    reabrir: () => Promise<Passo[]>;
    concluidos: number[];
  };

  async function montar(passos: Passo[]) {
    servicoFake = {
      concluidos: [],
      listar: () => Promise.resolve(passos),
      listarRns: () => Promise.resolve([]),
      pessoas: () => Promise.resolve({ levantadores: [], consultores: [] }),
      definirPessoas: () => Promise.resolve([]),
      // Levantadores vêm do PAPEL 'Levantador' no cadastro, não da lista de consultores.
      pessoasPorPapel: (papel: string) =>
        Promise.resolve(papel === 'Levantador' ? ['Ana GCI', 'Caio GCI'] : []),
      concluir: (_id: number, numero: number) => {
        servicoFake.concluidos.push(numero);
        return Promise.resolve(passos);
      },
      conferir: () => Promise.resolve(passos),
      reabrir: () => Promise.resolve(passos),
    };

    TestBed.configureTestingModule({
      imports: [PassosComponent],
      providers: [
        provideRouter([]),
        { provide: PassosService, useValue: servicoFake },
        {
          provide: DesignacaoService,
          useValue: {
            obterAgendar: () => Promise.resolve({ gci: '', dataLevantamento: '', hojeIso: '' }),
            obterConsultores: () =>
              Promise.resolve({ modulos: [], consultores: ['Ana', 'Bruno'], atuais: {} }),
            obterDefinirGci: () => Promise.resolve({ gciAtual: '', gcis: ['GCI Um'] }),
            agendar: () => Promise.resolve({}),
            definirGci: () => Promise.resolve({}),
          },
        },
        { provide: ProjetosService, useValue: { buscar: () => Promise.resolve(projeto()) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(PassosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    // O carregamento é feito por um encadeamento de promises no construtor; sem ceder o
    // event loop uma vez, o DOM ainda mostra "Carregando…" quando o teste olha.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture;
  }

  it('agrupa os passos por macro-etapa, preservando a ordem do processo', async () => {
    const fixture = await montar([
      passo({ numero: 1, etapa: 'Agendamento' }),
      passo({ numero: 2, etapa: 'Agendamento' }),
      passo({ numero: 3, etapa: 'Levantamento' }),
    ]);
    const grupos = fixture.componentInstance.porEtapa();
    expect(grupos.map((g) => g.etapa)).toEqual(['Agendamento', 'Levantamento']);
    expect(grupos[0].itens.map((i) => i.numero)).toEqual([1, 2]);
  });

  it('calcula o progresso pelos passos concluídos', async () => {
    const fixture = await montar([
      passo({ numero: 1, concluido: true }),
      passo({ numero: 2 }),
      passo({ numero: 3 }),
      passo({ numero: 4 }),
    ]);
    expect(fixture.componentInstance.concluidos()).toBe(1);
    expect(fixture.componentInstance.progresso()).toBe(25);
  });

  it('mostra o motivo quando o passo não está liberado para quem olha', async () => {
    const fixture = await montar([
      passo({
        numero: 6,
        titulo: 'Indicar o GCI',
        liberado: false,
        motivos: ['Só o responsável (Coordenador) pode concluir.'],
      }),
    ]);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Só o responsável (Coordenador) pode concluir.');
  });

  it('os passos que exigem dados abrem formulário em vez de só concluir', async () => {
    // Foi a reclamação do usuário: "Agendar Levantamento" não abria onde informar os
    // levantadores e a data.
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.formDoPasso(passo({ numero: 2 }))).toBe('agendar');
    expect(c.formDoPasso(passo({ numero: 6 }))).toBe('designar');
    expect(c.formDoPasso(passo({ numero: 13 }))).toBeNull();
  });

  it('lista como levantador SÓ quem tem o papel Levantador', async () => {
    // Regra do usuário: "só devem ser listados nas opções de Levantador(es) os GCI" — e o
    // que define isso é a marcação de papel no cadastro, não ser consultor do projeto.
    const fixture = await montar([passo({ numero: 2, titulo: 'Agendar' })]);
    const c = fixture.componentInstance;
    await c.abrirForm(passo({ numero: 2 }));
    expect(c.formAberto()).toBe(2);
    expect(c.levantadoresDisponiveis()).toEqual(['Ana GCI', 'Caio GCI']);
  });

  it('marca e desmarca pessoa na seleção múltipla, sem repetir', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    let sel: string[] = [];
    sel = c.alternarSelecao(sel, 'Ana', true);
    sel = c.alternarSelecao(sel, 'Ana', true);
    sel = c.alternarSelecao(sel, 'Bruno', true);
    expect(sel).toEqual(['Ana', 'Bruno']);
    sel = c.alternarSelecao(sel, 'Ana', false);
    expect(sel).toEqual(['Bruno']);
  });

  it('só reconhece conferência nos passos 9 e 16', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(c.temConferencia(passo({ numero: 9 }))).toBe(true);
    expect(c.temConferencia(passo({ numero: 16 }))).toBe(true);
    expect(c.temConferencia(passo({ numero: 10 }))).toBe(false);
  });

  it('sinaliza quando um passo concluído ainda aguarda conferência', async () => {
    const fixture = await montar([passo()]);
    const c = fixture.componentInstance;
    expect(
      c.aguardandoConferencia(passo({ numero: 9, concluido: true, conferido: false })),
    ).toBe(true);
    expect(
      c.aguardandoConferencia(passo({ numero: 9, concluido: true, conferido: true })),
    ).toBe(false);
  });
});
