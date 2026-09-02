import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ControleAtividadesComponent } from './controle-atividades.component';
import { ControleAtividadesService } from '../../core/services/controle-atividades.service';
import {
  ListaDeQuadros,
  QuadroCompleto,
} from '../../core/models/controle-atividades.model';

function quadroResumo(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    codigoClienteSicla: '10482',
    nomeCliente: 'Vale Verde',
    projetoId: 1,
    responsaveis: [{ usuarioId: 7, nome: 'Everton', principal: true }],
    abertosInternos: 2,
    abertosCompartilhados: 1,
    meu: true,
    ...over,
  };
}

const RAIL: ListaDeQuadros = {
  meus: [quadroResumo()],
  demais: [
    quadroResumo({
      id: 2,
      codigoClienteSicla: '20913',
      nomeCliente: 'Serra Azul',
      responsaveis: [{ usuarioId: 9, nome: 'Marina', principal: true }],
      meu: false,
    }),
    quadroResumo({
      id: 3,
      codigoClienteSicla: '30177',
      nomeCliente: 'Nova Era',
      responsaveis: [{ usuarioId: 11, nome: 'Júlio', principal: true }],
      meu: false,
    }),
  ],
  consultores: [
    { usuarioId: 9, nome: 'Marina' },
    { usuarioId: 11, nome: 'Júlio' },
  ],
};

function quadro(over: Partial<QuadroCompleto> = {}): QuadroCompleto {
  return {
    quadro: {
      id: 1,
      codigoClienteSicla: '10482',
      nomeCliente: 'Vale Verde',
      projetoId: 1,
      responsaveis: [{ usuarioId: 7, nome: 'Everton', principal: true }],
    },
    podeEditar: true,
    podeInteragir: true,
    podeCriarCartao: true,
    interno: true,
    souResponsavel: true,
    listas: [
      { id: 10, titulo: 'A fazer', ordem: 1, visivelCliente: true },
      { id: 11, titulo: 'Bastidor Rech', ordem: 2, visivelCliente: false },
    ],
    cartoes: [
      {
        id: 100,
        listaId: 10,
        titulo: 'Conferir NCM',
        descricao: '',
        ordem: 1,
        visivelCliente: true,
        origem: 'consultor',
        etiquetas: [],
        prazo: '',
        concluido: false,
        criadoPorNome: 'Everton',
        membros: [],
        checklist: [],
        anexos: [],
        comentarios: [],
      },
    ],
    ocultos: { cartoesInternos: 2, colunasInternas: 1, cartoesEmColunasInternas: 3 },
    ...over,
  };
}

function servico(over: Partial<ControleAtividadesService> = {}) {
  return {
    quadros: () => Promise.resolve(RAIL),
    etiquetas: () => Promise.resolve([{ chave: 'conv', nome: 'Conversão' }]),
    consultores: () => Promise.resolve([{ usuarioId: 9, nome: 'Marina', perfil: 'GCI' }]),
    quadro: () => Promise.resolve(quadro()),
    contatos: () => Promise.resolve([]),
    buscar: () =>
      Promise.resolve({ termo: '', total: 0, truncado: false, quadros: 0, achados: [] }),
    ...over,
  } as unknown as ControleAtividadesService;
}

async function montar(api = servico()) {
  TestBed.configureTestingModule({
    imports: [ControleAtividadesComponent],
    providers: [
      // A tela reescreve a URL com o cliente aberto (deep-link do aviso). Sem a rota
      // declarada aqui, o Router rejeita a navegação e o teste morre num erro que não tem
      // nada a ver com o que está sendo verificado.
      provideRouter([{ path: 'atividades/:codigo', children: [] }]),
      { provide: ControleAtividadesService, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(ControleAtividadesComponent);
  fixture.detectChanges();
  // A carga inicial encadeia várias promessas (rail → quadro → navegação de deep-link), e
  // um único `whenStable` resolve só a primeira delas — a tela ainda estaria em
  // "Carregando…". Alguns ciclos drenam a fila até o quadro estar montado.
  for (let i = 0; i < 6; i += 1) {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }
  return fixture;
}

describe('ControleAtividadesComponent', () => {
  it('abre na aba "Meus clientes" — a regra do usuário', async () => {
    const f = await montar();
    expect(f.componentInstance.aba()).toBe('meus');
    expect(f.componentInstance.listaDoRail().map((q) => q.codigoClienteSicla)).toEqual([
      '10482',
    ]);
  });

  it('a aba "Demais consultores" lista os quadros dos outros', async () => {
    const f = await montar();
    f.componentInstance.trocarAba('demais');
    expect(f.componentInstance.listaDoRail().map((q) => q.nomeCliente)).toEqual([
      'Serra Azul',
      'Nova Era',
    ]);
  });

  it('o filtro de consultor recorta a aba "Demais"', async () => {
    const f = await montar();
    f.componentInstance.trocarAba('demais');
    f.componentInstance.filtroConsultor.set(11);
    expect(f.componentInstance.listaDoRail().map((q) => q.nomeCliente)).toEqual(['Nova Era']);
  });

  it('trocar de aba zera o filtro de consultor — senão a aba nova viria vazia sem motivo visível', async () => {
    const f = await montar();
    f.componentInstance.trocarAba('demais');
    f.componentInstance.filtroConsultor.set(11);
    f.componentInstance.trocarAba('meus');
    expect(f.componentInstance.filtroConsultor()).toBe(0);
  });

  it('o filtro de texto age dentro da aba, e avisa quando o achado está na outra', async () => {
    const f = await montar();
    f.componentInstance.filtroCliente.set('serra');
    expect(f.componentInstance.listaDoRail()).toEqual([]);
    expect(f.componentInstance.naOutraAba()).toBe(1);
  });

  it('mostra o quadro do primeiro cliente e as suas colunas', async () => {
    const f = await montar();
    const txt = f.nativeElement.textContent as string;
    expect(txt).toContain('Vale Verde');
    expect(txt).toContain('A fazer');
    expect(txt).toContain('Conferir NCM');
  });

  it('avisa quantos cartões o cliente NÃO vê', async () => {
    const f = await montar();
    expect(f.nativeElement.textContent).toContain('não aparecem para o cliente');
  });

  it('quadro de outro consultor entra em somente-consulta, sem ação de escrita', async () => {
    const f = await montar(
      servico({
        quadro: () =>
          Promise.resolve(
            quadro({ podeEditar: false, podeInteragir: false, podeCriarCartao: false, souResponsavel: false }),
          ),
      } as Partial<ControleAtividadesService>),
    );
    expect(f.componentInstance.soConsulta()).toBe(true);
    expect(f.nativeElement.textContent).toContain('Somente consulta');
    expect(f.nativeElement.querySelector('.ca-add')).toBeNull();
  });

  it('o cliente não vê as abas nem a coluna interna', async () => {
    const f = await montar(
      servico({
        quadros: () =>
          Promise.resolve({ meus: [quadroResumo()], demais: [], consultores: [] }),
        quadro: () =>
          Promise.resolve(
            quadro({
              interno: false,
              podeEditar: false,
              podeCriarCartao: true,
              listas: [{ id: 10, titulo: 'A fazer', ordem: 1, visivelCliente: true }],
              ocultos: null,
            }),
          ),
      } as Partial<ControleAtividadesService>),
    );
    expect(f.nativeElement.querySelector('.ca-abas')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('Bastidor Rech');
    // O cliente PODE abrir solicitação (decisão do usuário, 2026-09-01).
    expect(f.nativeElement.textContent).toContain('Abrir solicitação');
  });

  describe('edição do cartão (o defeito de 2026-09-01: descrição não era editável)', () => {
    it('quem pode editar recebe CAMPOS, não texto fixo', async () => {
      const f = await montar();
      f.componentInstance.abrirCartao(100);
      f.detectChanges();
      const area = f.nativeElement.querySelector('textarea[aria-label="Descrição"]');
      const titulo = f.nativeElement.querySelector('input[aria-label="Título do cartão"]');
      const prazo = f.nativeElement.querySelector('input[aria-label="Prazo"]');
      expect(area).not.toBeNull();
      expect(titulo).not.toBeNull();
      expect(prazo).not.toBeNull();
    });

    it('o botão Salvar só aparece quando há mudança', async () => {
      const f = await montar();
      f.componentInstance.abrirCartao(100);
      f.detectChanges();
      expect(f.componentInstance.cartaoMudou()).toBe(false);
      f.componentInstance.rascDescricao.set('Agora tem descrição.');
      f.detectChanges();
      expect(f.componentInstance.cartaoMudou()).toBe(true);
      expect(f.nativeElement.textContent).toContain('Salvar cartão');
    });

    it('salva descrição, título, prazo e etiquetas de uma vez', async () => {
      const editar = vi.fn(() => Promise.resolve());
      const f = await montar(
        servico({ editarCartao: editar } as unknown as Partial<ControleAtividadesService>),
      );
      f.componentInstance.abrirCartao(100);
      f.componentInstance.rascDescricao.set('Conferir os 137 itens sem NCM.');
      f.componentInstance.rascPrazo.set('2026-09-30');
      f.componentInstance.alternarEtiqueta('conv');
      await f.componentInstance.salvarCartao();
      expect(editar).toHaveBeenCalledWith(100, {
        titulo: 'Conferir NCM',
        descricao: 'Conferir os 137 itens sem NCM.',
        prazo: '2026-09-30',
        etiquetas: ['conv'],
      });
    });

    it('recusa título vazio — é a identidade do cartão no quadro', async () => {
      const editar = vi.fn(() => Promise.resolve());
      const f = await montar(
        servico({ editarCartao: editar } as unknown as Partial<ControleAtividadesService>),
      );
      f.componentInstance.abrirCartao(100);
      f.componentInstance.rascTitulo.set('   ');
      await f.componentInstance.salvarCartao();
      expect(editar).not.toHaveBeenCalled();
      expect(f.componentInstance.erro()).toContain('não pode ficar vazio');
    });

    it('descartar volta ao que estava salvo', async () => {
      const f = await montar();
      f.componentInstance.abrirCartao(100);
      f.componentInstance.rascDescricao.set('rascunho perdido');
      f.componentInstance.descartarEdicao();
      expect(f.componentInstance.rascDescricao()).toBe('');
      expect(f.componentInstance.cartaoMudou()).toBe(false);
    });

    it('quem está em consulta continua vendo texto, sem campo', async () => {
      const f = await montar(
        servico({
          quadro: () =>
            Promise.resolve(
              quadro({ podeEditar: false, podeInteragir: false, souResponsavel: false }),
            ),
        } as Partial<ControleAtividadesService>),
      );
      f.componentInstance.abrirCartao(100);
      f.detectChanges();
      expect(f.nativeElement.querySelector('textarea[aria-label="Descrição"]')).toBeNull();
      expect(f.nativeElement.textContent).toContain('Sem descrição.');
    });
  });

  it('mostra mensagem quando a carga falha', async () => {
    const f = await montar(
      servico({ quadros: () => Promise.reject(new Error('falhou')) } as Partial<ControleAtividadesService>),
    );
    expect(f.nativeElement.textContent).toContain(
      'Não foi possível carregar o Controle de Atividades.',
    );
  });
});
