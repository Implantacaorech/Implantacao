import { TestBed } from '@angular/core/testing';
import { PermissoesService } from '../../core/services/permissoes.service';
import { WalleService } from '../../core/services/walle.service';
import {
  RespostaBuscaWalle,
  ResultadoWalle,
  StatusAcervoWalle,
} from '../../core/models/walle.model';
import { WalleComponent } from './walle.component';

/** Tela Execução → Wall-e — testes herméticos (service fake injetado, sem HTTP), no molde
 * do rns.component.spec: asserções sobre os signals/computeds, não sobre o DOM. */

function resultado(over: Partial<ResultadoWalle> = {}): ResultadoWalle {
  return {
    arquivoId: 1,
    chat: 42,
    chatDescricao: '',
    tecnico: '',
    sistema: '',
    titulo: 'Investigação WhatsApp',
    resumo: 'Há um robô.',
    categoria: 'investigacao',
    origem: 'produzido',
    extensao: 'md',
    modificadoEm: '2026-08-17T10:00:00',
    relevancia: 96,
    confianca: 'alta',
    assuntos: ['integracao', 'whatsapp'],
    evidencias: ['título contém "whatsapp"'],
    ...over,
  };
}

function busca(itens: ResultadoWalle[]): RespostaBuscaWalle {
  return {
    resumo: itens.length === 0
      ? 'Não foi localizado material relevante no acervo documental consultado.'
      : `Foram encontrados ${itens.length} documento(s).`,
    total: itens.length,
    resultados: itens,
    assuntosRelacionados: ['bot', 'automacao'],
    tambemPodeSerUtil: [],
    sqlsRelacionados: [],
    sugestoes: [],
    cobertura: 'A pesquisa consultou o acervo documental indexado (20 arquivo(s) de 9 chat(s)).',
  };
}

function statusAcervo(): StatusAcervoWalle {
  return {
    dirAcervo: 'R:\\GRM\\CHAT_WALLE',
    fonteDisponivel: true,
    chats: 9,
    arquivos: 20,
    ultimaAtualizacao: '2026-08-18T14:30:00',
    ultimoResumo: null,
    oracle: null,
    limitacoes: 'O acervo documental representa apenas os chats com arquivos.',
  };
}

function fakeService(itens: ResultadoWalle[] = [resultado()]) {
  return {
    status: vi.fn(() => Promise.resolve(statusAcervo())),
    atualizar: vi.fn(() => Promise.resolve(statusAcervo())),
    pesquisar: vi.fn(() => Promise.resolve(busca(itens))),
    perguntar: vi.fn(() =>
      Promise.resolve({
        resposta: 'Resposta direta: sim [1].',
        fontes: [
          { indice: 1, arquivoId: 1, chat: 42, titulo: 'Investigação', caminhoRelativo: '42/x.md' },
        ],
        temFundamento: true,
        iaDisponivel: true,
        busca: busca(itens),
      }),
    ),
    chats: vi.fn(() => Promise.resolve([])),
    visaoChat: vi.fn(),
    arquivo: vi.fn(),
    imagem: vi.fn(),
  };
}

const PERM_FAKE = {
  podeVer: () => true,
  podeAlterar: () => true,
};

describe('WalleComponent (Execução → Wall-e)', () => {
  function montar(service: ReturnType<typeof fakeService>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WalleComponent],
      providers: [
        { provide: WalleService, useValue: service },
        { provide: PermissoesService, useValue: PERM_FAKE },
      ],
    });
    return TestBed.createComponent(WalleComponent);
  }

  async function pronto(service: ReturnType<typeof fakeService>) {
    const fixture = montar(service);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('carga inicial: busca status e navega pelos documentos (sem pergunta)', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    expect(service.status).toHaveBeenCalled();
    expect(service.pesquisar).toHaveBeenCalled();
    expect(comp.status()?.arquivos).toBe(20);
    expect(comp.busca()?.resultados).toHaveLength(1);
    expect(comp.carregando()).toBe(false);
  });

  it('pesquisar repassa filtros ao service e limpa resposta anterior da IA', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    comp.q.set('integração whatsapp');
    comp.categoria.set('sql');
    comp.chatFiltro.set('42');
    await comp.pesquisar();
    expect(service.pesquisar).toHaveBeenLastCalledWith({
      q: 'integração whatsapp',
      categoria: 'sql',
      origem: undefined,
      chat: 42,
    });
    expect(comp.respostaIa()).toBeNull();
  });

  it('erro do backend não derruba a tela: mensagem em pt-BR e carregando desligado', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    service.pesquisar.mockRejectedValueOnce(new Error('rede caiu'));
    await comp.pesquisar();
    expect(comp.erro()).toContain('Não foi possível consultar o acervo');
    expect(comp.carregando()).toBe(false);
  });

  it('assunto clicável vira nova pesquisa contextualizada (§15)', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    await comp.pesquisarAssunto('automacao');
    expect(comp.q()).toBe('automacao');
    expect(service.pesquisar).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'automacao' }),
    );
  });

  it('perguntar exige texto, popula a resposta da IA e reaproveita a busca embutida', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    await comp.perguntar(); // q vazio — não chama
    expect(service.perguntar).not.toHaveBeenCalled();
    comp.q.set('já analisamos moeda estrangeira?');
    await comp.perguntar();
    expect(service.perguntar).toHaveBeenCalledWith('já analisamos moeda estrangeira?');
    expect(comp.respostaIa()?.temFundamento).toBe(true);
    expect(comp.busca()?.total).toBe(1);
  });

  it('limpar filtros zera tudo e volta à navegação', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    comp.q.set('x');
    comp.categoria.set('sql');
    await comp.limparFiltros();
    expect(comp.q()).toBe('');
    expect(comp.categoria()).toBe('');
    expect(comp.temFiltro()).toBe(false);
    expect(service.pesquisar).toHaveBeenLastCalledWith({
      q: undefined,
      categoria: undefined,
      origem: undefined,
      chat: undefined,
    });
  });

  it('atualizar acervo recarrega status e repete a pesquisa', async () => {
    const service = fakeService();
    const comp = await pronto(service);
    await comp.atualizarAcervo();
    expect(service.atualizar).toHaveBeenCalled();
    expect(service.pesquisar).toHaveBeenCalledTimes(2); // carga inicial + pós-atualização
    expect(comp.atualizando()).toBe(false);
  });
});
