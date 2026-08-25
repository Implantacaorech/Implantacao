import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ConsultorSigerService } from './consultor-siger.service';
import { environment } from '../../../environments/environment';

describe('ConsultorSigerService', () => {
  let service: ConsultorSigerService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/consultor-siger`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ConsultorSigerService],
    });
    service = TestBed.inject(ConsultorSigerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manda a pergunta e a visão como query params', async () => {
    const p = service.pesquisar('como funciona o faturamento?', 'tecnica');
    const req = http.expectOne((r) => r.url === `${base}/pesquisa`);
    expect(req.request.params.get('q')).toBe('como funciona o faturamento?');
    expect(req.request.params.get('visao')).toBe('tecnica');
    req.flush({ data: { pergunta: 'x', confianca: 'alta' } });
    await p;
  });

  // Blindagem: o navegador pode estar com bundle mais novo que o processo no ar.
  it('completa listas ausentes da resposta em vez de deixar undefined', async () => {
    const p = service.pesquisar('faturamento', 'funcional');
    const req = http.expectOne((r) => r.url === `${base}/pesquisa`);
    req.flush({ data: { pergunta: 'faturamento', confianca: 'baixa' } });
    const r = await p;
    expect(r.secoes).toEqual({});
    expect(r.assuntosRelacionados).toEqual([]);
    expect(r.sugestoes).toEqual([]);
    expect(r.fontes).toEqual([]);
  });

  it('feedback vai por POST com a pergunta e o veredito', async () => {
    const p = service.enviarFeedback('como configurar NF?', false, 'faltou a série');
    const req = http.expectOne(`${base}/feedback`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pergunta: 'como configurar NF?',
      util: false,
      observacao: 'faltou a série',
    });
    req.flush({ data: { ok: true } });
    await p;
  });
});
