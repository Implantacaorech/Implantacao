import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { PreferenciasService } from './preferencias.service';

const BASE = `${environment.apiUrl}/preferencias`;

function envelope<T>(data: T) {
  return { success: true, message: 'ok', timestamp: '', data };
}

describe('PreferenciasService', () => {
  let service: PreferenciasService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('painel.accessToken', 'tok');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PreferenciasService);
    http = TestBed.inject(HttpTestingController);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Carrega o mapa e devolve o controlador já limpo, para os testes seguintes só verem o
   * tráfego que eles próprios provocam. */
  async function carregarCom(preferencias: Record<string, unknown>): Promise<void> {
    const p = service.garantirCarregado();
    http.expectOne(BASE).flush(envelope({ preferencias }));
    await p;
  }

  it('carrega o mapa numa chamada só e expõe os valores', async () => {
    await carregarCom({ capacidade: { setor: 'GRM-Suporte' } });

    expect(service.carregadas).toBe(true);
    expect(service.ler('capacidade')).toEqual({ setor: 'GRM-Suporte' });
    expect(service.ler('inexistente')).toBeNull();
  });

  it('chamadas concorrentes compartilham a mesma requisição', async () => {
    const a = service.garantirCarregado();
    const b = service.garantirCarregado();
    http.expectOne(BASE).flush(envelope({ preferencias: {} }));
    await Promise.all([a, b]);

    http.verify(); // uma requisição só — a segunda chamada não abriu outra
  });

  it('não chama o servidor sem sessão (a tela de login não tem filtro a restaurar)', async () => {
    localStorage.removeItem('painel.accessToken');

    await service.garantirCarregado();

    http.expectNone(BASE);
    // E não marca como carregado: a primeira tela DEPOIS do login ainda vai buscar.
    expect(service.carregadas).toBe(false);
  });

  it('falha ao carregar não repete a chamada a cada tela', async () => {
    const p = service.garantirCarregado();
    http.expectOne(BASE).error(new ProgressEvent('erro'));
    await p;

    expect(service.carregadas).toBe(true);
    await service.garantirCarregado();
    http.expectNone(BASE);
  });

  it('agrupa gravações em rajada numa só (debounce)', async () => {
    await carregarCom({});

    service.salvar('tela', { q: 'a' });
    service.salvar('tela', { q: 'ab' });
    service.salvar('tela', { q: 'abc' });
    http.expectNone(`${BASE}/tela`); // ainda dentro da janela do debounce
    vi.runAllTimers();

    const req = http.expectOne(`${BASE}/tela`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ valor: { q: 'abc' } }); // só o último estado
    req.flush(envelope({ salvo: true }));
  });

  it('não regrava valor idêntico ao que já está no servidor', async () => {
    await carregarCom({ tela: { q: 'a' } });

    service.salvar('tela', { q: 'a' });
    vi.runAllTimers();

    http.expectNone(`${BASE}/tela`);
  });

  it('depois de gravar, o mesmo valor não vai de novo — mas um diferente vai', async () => {
    await carregarCom({});

    service.salvar('tela', { q: 'a' });
    vi.runAllTimers();
    http.expectOne(`${BASE}/tela`).flush(envelope({ salvo: true }));
    await Promise.resolve(); // deixa o `then` da gravação registrar o valor sincronizado

    service.salvar('tela', { q: 'a' });
    vi.runAllTimers();
    http.expectNone(`${BASE}/tela`);

    service.salvar('tela', { q: 'b' });
    vi.runAllTimers();
    expect(http.expectOne(`${BASE}/tela`).request.body).toEqual({ valor: { q: 'b' } });
  });

  it('gravação que falhou é tentada de novo na mexida seguinte', async () => {
    await carregarCom({});

    service.salvar('tela', { q: 'a' });
    vi.runAllTimers();
    http.expectOne(`${BASE}/tela`).error(new ProgressEvent('erro'));

    // Mesmo valor: como não sincronizou, o dedupe NÃO pode engolir a segunda tentativa.
    service.salvar('tela', { q: 'a' });
    vi.runAllTimers();
    expect(http.expectOne(`${BASE}/tela`).request.method).toBe('PUT');
  });

  it('ler devolve o valor já em memória logo após salvar, sem esperar o servidor', async () => {
    await carregarCom({});

    service.salvar('tela', { q: 'novo' });

    expect(service.ler('tela')).toEqual({ q: 'novo' });
    vi.runAllTimers();
    http.expectOne(`${BASE}/tela`).flush(envelope({ salvo: true }));
  });

  it('descartar apaga no servidor e não deixa a gravação seguinte recriar o registro', async () => {
    await carregarCom({ tela: { q: 'antigo' } });

    const p = service.descartar('tela', JSON.stringify({ q: '' }));
    const req = http.expectOne(`${BASE}/tela`);
    expect(req.request.method).toBe('DELETE');
    req.flush(envelope({ removido: true }));
    await p;

    expect(service.ler('tela')).toBeNull();
    // A tela volta ao padrão e a gravação automática dispara: tem de ser engolida pelo dedupe.
    service.salvar('tela', { q: '' });
    vi.runAllTimers();
    http.expectNone(`${BASE}/tela`);
  });

  it('descartar cancela gravação ainda pendente da mesma chave', async () => {
    await carregarCom({ tela: { q: 'antigo' } });

    service.salvar('tela', { q: 'na fila' });
    void service.descartar('tela', JSON.stringify({ q: '' }));
    http.expectOne(`${BASE}/tela`).flush(envelope({ removido: true })); // o DELETE
    vi.runAllTimers();

    http.expectNone(`${BASE}/tela`); // o PUT agendado não sobreviveu
  });

  it('limpar (troca de sessão) esquece tudo e não vaza filtro do usuário anterior', async () => {
    await carregarCom({ tela: { q: 'do outro' } });

    service.limpar();

    expect(service.carregadas).toBe(false);
    expect(service.ler('tela')).toBeNull();
  });

  it('limpar cancela gravações pendentes (não grava no usuário que acabou de entrar)', async () => {
    await carregarCom({});

    service.salvar('tela', { q: 'a' });
    service.limpar();
    vi.runAllTimers();

    http.expectNone(`${BASE}/tela`);
  });
});
