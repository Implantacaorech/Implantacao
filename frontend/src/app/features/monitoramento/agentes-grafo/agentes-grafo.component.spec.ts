import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgentesGrafoComponent } from './agentes-grafo.component';
import { AgentesService } from '../../../core/services/agentes.service';
import { AgenteExecucao, GrafoAgentes } from '../../../core/models/agente.model';

function grafo(over: Partial<GrafoAgentes> = {}): GrafoAgentes {
  return {
    nos: [
      { id: 'painel-core', categoria: 'software', rotulo: 'Painel-Core', ativo: false, execucoes24h: 0 },
      { id: 'qualidade', categoria: 'software', rotulo: 'Qualidade', ativo: true, execucoes24h: 2 },
      { id: 'coordenador-implantacao', categoria: 'negocio', rotulo: 'Coordenador', ativo: false, execucoes24h: 0 },
    ],
    arestas: [{ de: 'painel-core', para: 'qualidade', relacao: 'aciona ao terminar' }],
    ...over,
  };
}

function execucao(over: Partial<AgenteExecucao> = {}): AgenteExecucao {
  return {
    id: 1,
    agente: 'qualidade',
    agentePaiId: null,
    tarefa: 'Revisar PR #8',
    status: 'em_execucao',
    resultado: null,
    iniciadoEm: '2026-07-19T22:00:00.000Z',
    concluidoEm: null,
    ...over,
  };
}

describe('AgentesGrafoComponent', () => {
  let fixtureAtual: ComponentFixture<AgentesGrafoComponent> | null = null;

  afterEach(() => {
    // O componente tem setInterval (polling) — sem destruir explicitamente, o timer
    // vaza para o próximo teste (fonte real de flakiness observada aqui).
    fixtureAtual?.destroy();
    fixtureAtual = null;
  });

  function montar(service: Partial<AgentesService>) {
    TestBed.configureTestingModule({
      imports: [AgentesGrafoComponent],
      providers: [{ provide: AgentesService, useValue: service }],
    });
    fixtureAtual = TestBed.createComponent(AgentesGrafoComponent);
    return fixtureAtual;
  }

  /** Espera até o texto aparecer, com timeout curto — mais robusto que um único
   * `whenStable()` para um componente com múltiplos `await` sequenciais. */
  async function esperarTexto(fixture: ComponentFixture<AgentesGrafoComponent>, trecho: string) {
    const limite = Date.now() + 2000;
    while (Date.now() < limite) {
      fixture.detectChanges();
      if ((fixture.nativeElement.textContent as string).includes(trecho)) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    fixture.detectChanges();
    throw new Error(
      `Texto "${trecho}" não apareceu a tempo. Conteúdo atual: ${fixture.nativeElement.textContent}`,
    );
  }

  it('renderiza os nós do grafo com o rótulo real (não dado inventado)', async () => {
    const fixture = montar({
      grafo: () => Promise.resolve(grafo()),
      execucoes: () => Promise.resolve([]),
    });
    await esperarTexto(fixture, 'Painel-Core');
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Qualidade');
    expect(texto).toContain('Coordenador');
    expect(texto).toContain('1 ativo(s) agora'); // só "qualidade" está ativo=true
  });

  it('sem nenhuma execução real, mostra o estado vazio honesto (não finge dado)', async () => {
    const fixture = montar({
      grafo: () => Promise.resolve(grafo({ nos: [] })),
      execucoes: () => Promise.resolve([]),
    });
    await esperarTexto(fixture, 'Nenhuma execução registrada ainda');
  });

  it('lista execuções reais recebidas do backend, com status', async () => {
    const fixture = montar({
      grafo: () => Promise.resolve(grafo()),
      execucoes: () =>
        Promise.resolve([
          execucao(),
          execucao({ id: 2, status: 'concluido', concluidoEm: '2026-07-19T22:05:00.000Z' }),
        ]),
    });
    await esperarTexto(fixture, 'Revisar PR #8');
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('em_execucao');
    expect(texto).toContain('concluido');
  });

  it('mostra mensagem de erro quando a API falha', async () => {
    const fixture = montar({
      grafo: () => Promise.reject(new Error('falhou')),
      execucoes: () => Promise.resolve([]),
    });
    await esperarTexto(fixture, 'Não foi possível carregar os agentes.');
  });
});
