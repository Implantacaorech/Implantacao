import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PreferenciasService } from '../services/preferencias.service';
import {
  deCamposDe,
  deSet,
  deSignal,
  filtrosSalvos,
} from './filtros-salvos';

const BASE = `${environment.apiUrl}/preferencias`;

function envelope<T>(data: T) {
  return { success: true, message: 'ok', timestamp: '', data };
}

describe('filtrosSalvos', () => {
  let prefs: PreferenciasService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('painel.accessToken', 'tok');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    prefs = TestBed.inject(PreferenciasService);
    http = TestBed.inject(HttpTestingController);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Deixa o serviço no estado do fluxo normal do Painel: mapa já carregado pelo authGuard. */
  async function preCarregar(preferencias: Record<string, unknown>): Promise<void> {
    const p = prefs.garantirCarregado();
    http.expectOne(BASE).flush(envelope({ preferencias }));
    await p;
  }

  describe('restauração', () => {
    it('aplica a seleção salva de forma SÍNCRONA quando o mapa já está em memória', async () => {
      await preCarregar({ tela: { busca: 'ana', setor: 'GRM-Suporte' } });
      const busca = signal('');
      const setor = signal('');

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca), setor: deSignal(setor) }),
      );

      // Sem await: é isto que permite a primeira carga da tela já sair filtrada.
      expect(busca()).toBe('ana');
      expect(setor()).toBe('GRM-Suporte');
    });

    it('sem nada salvo, deixa os padrões da tela em paz', async () => {
      await preCarregar({});
      const busca = signal('padrão');

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      expect(busca()).toBe('padrão');
    });

    it('ignora campo salvo que não existe mais na tela', async () => {
      await preCarregar({ tela: { sumiu: 'x', busca: 'ok' } });
      const busca = signal('');

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      expect(busca()).toBe('ok');
    });

    it('ignora valor cujo FORMATO mudou (era texto, virou lista)', async () => {
      await preCarregar({ tela: { grupo: 'G1' } }); // gravado quando o filtro era texto
      const grupo = signal<string[]>([]);

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { grupo: deSignal(grupo) }),
      );

      expect(grupo()).toEqual([]); // não entrou como string e quebrou o `@for` da tela
    });

    it('aceita lista de primitivos e recusa lista de objetos', async () => {
      await preCarregar({ tela: { bom: ['A', 'B'], ruim: [{ x: 1 }] } });
      const bom = signal<string[]>([]);
      const ruim = signal<string[]>([]);

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { bom: deSignal(bom), ruim: deSignal(ruim) }),
      );

      expect(bom()).toEqual(['A', 'B']);
      expect(ruim()).toEqual([]);
    });

    it('campo com padrão nulo aceita primitivo (ex.: mês selecionado)', async () => {
      await preCarregar({ tela: { mes: 7 } });
      const mes = signal<number | null>(null);

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { mes: deSignal(mes) }),
      );

      expect(mes()).toBe(7);
    });

    it('no caminho síncrono, quem vem depois manda (é o `?q=` da Carteira)', async () => {
      await preCarregar({ tela: { busca: 'salvo' } });
      const busca = signal('');

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );
      expect(busca()).toBe('salvo');
      // A tela lê a rota DEPOIS de declarar os filtros salvos; um link explícito vence.
      busca.set('veio-da-url');

      expect(busca()).toBe('veio-da-url');
    });

    it('na restauração tardia, não atropela o que a tela já mudou no meio', async () => {
      const busca = signal('');
      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      busca.set('veio-da-url'); // a tela agiu enquanto o mapa vinha do servidor
      http.expectOne(BASE).flush(envelope({ preferencias: { tela: { busca: 'salvo' } } }));
      await vi.advanceTimersByTimeAsync(0);

      expect(busca()).toBe('veio-da-url');
    });

    it('restaura Set a partir da lista guardada', async () => {
      await preCarregar({ tela: { situacoes: ['Em andamento', 'Concluída'] } });
      let situacoes = new Set<string>();

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', {
          situacoes: deSet(
            () => situacoes,
            (v) => {
              situacoes = v;
            },
          ),
        }),
      );

      expect([...situacoes]).toEqual(['Em andamento', 'Concluída']);
    });

    it('restaura propriedades comuns com deCamposDe', async () => {
      await preCarregar({ tela: { fStatus: 'Agendada', fTecnico: 'Ana' } });
      const alvo = { fStatus: '', fTecnico: '', fData: '' };

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', deCamposDe(alvo, 'fStatus', 'fTecnico', 'fData')),
      );

      expect(alvo).toEqual({ fStatus: 'Agendada', fTecnico: 'Ana', fData: '' });
    });
  });

  describe('restauração tardia (mapa ainda não carregado)', () => {
    it('aplica quando a resposta chega e avisa a tela para recarregar', async () => {
      const busca = signal('');
      const aoRestaurar = vi.fn();

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }, { aoRestaurar }),
      );

      expect(busca()).toBe(''); // ainda não chegou
      http.expectOne(BASE).flush(envelope({ preferencias: { tela: { busca: 'ana' } } }));
      await vi.advanceTimersByTimeAsync(0);

      expect(busca()).toBe('ana');
      expect(aoRestaurar).toHaveBeenCalledTimes(1);
    });

    it('não manda recarregar quando não havia nada salvo', async () => {
      const busca = signal('');
      const aoRestaurar = vi.fn();

      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }, { aoRestaurar }),
      );
      http.expectOne(BASE).flush(envelope({ preferencias: {} }));
      await vi.advanceTimersByTimeAsync(0);

      expect(aoRestaurar).not.toHaveBeenCalled();
    });

    it('não grava nada antes de terminar de restaurar (senão o padrão apagaria o salvo)', async () => {
      const busca = signal('');
      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );
      TestBed.tick();

      // O `effect` já rodou com o valor padrão, mas nada pode ter sido enviado.
      vi.runAllTimers();
      http.expectOne(BASE); // só a leitura do mapa
      http.verify();
    });
  });

  describe('gravação', () => {
    it('grava sozinho quando um filtro em signal muda', async () => {
      await preCarregar({});
      const busca = signal('');
      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      busca.set('ana');
      TestBed.tick();
      vi.runAllTimers();

      expect(http.expectOne(`${BASE}/tela`).request.body).toEqual({
        valor: { busca: 'ana' },
      });
    });

    it('não cria preferência só porque a pessoa passou pela tela', async () => {
      await preCarregar({});
      const busca = signal('');
      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      TestBed.tick();
      vi.runAllTimers();

      http.expectNone(`${BASE}/tela`);
    });

    it('voltar tudo ao padrão SOBRESCREVE o que estava salvo', async () => {
      await preCarregar({ tela: { busca: 'antigo' } });
      const busca = signal('');
      TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );
      expect(busca()).toBe('antigo');

      busca.set('');
      TestBed.tick();
      vi.runAllTimers();

      expect(http.expectOne(`${BASE}/tela`).request.body).toEqual({
        valor: { busca: '' },
      });
    });

    it('propriedade comum só grava quando a tela chama salvar()', async () => {
      await preCarregar({});
      const alvo = { fStatus: '' };
      const salvos = TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', deCamposDe(alvo, 'fStatus')),
      );
      TestBed.tick(); // deixa a primeira passada do `effect` acontecer

      alvo.fStatus = 'Agendada';
      TestBed.tick();
      vi.runAllTimers();
      http.expectNone(`${BASE}/tela`); // campo comum não é observável

      salvos.salvar();
      vi.runAllTimers();
      expect(http.expectOne(`${BASE}/tela`).request.body).toEqual({
        valor: { fStatus: 'Agendada' },
      });
    });

    it('descartar apaga a preferência da tela', async () => {
      await preCarregar({ tela: { busca: 'antigo' } });
      const busca = signal('');
      const salvos = TestBed.runInInjectionContext(() =>
        filtrosSalvos('tela', { busca: deSignal(busca) }),
      );

      busca.set('');
      void salvos.descartar();

      const req = http.expectOne(`${BASE}/tela`);
      expect(req.request.method).toBe('DELETE');
      req.flush(envelope({ removido: true }));
      // A gravação automática que vem atrás não pode ressuscitar o registro.
      TestBed.tick();
      vi.runAllTimers();
      http.expectNone(`${BASE}/tela`);
    });
  });
});
