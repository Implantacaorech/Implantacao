import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BiImplantacaoService } from './bi-implantacao.service';
import { environment } from '../../../environments/environment';

describe('BiImplantacaoService', () => {
  let service: BiImplantacaoService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/bi-implantacao`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BiImplantacaoService],
    });
    service = TestBed.inject(BiImplantacaoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('repete a chave para cada valor de um filtro múltiplo', async () => {
    const p = service.resumo({ status: ['A', 'B'], rns: ['1'] });
    const req = http.expectOne((r) => r.url === `${base}/resumo`);
    expect(req.request.params.getAll('status')).toEqual(['A', 'B']);
    expect(req.request.params.getAll('rns')).toEqual(['1']);
    req.flush({ data: { filtros: {}, selecionados: {} } });
    await p;
  });

  it('manda status e rns também no extrato', async () => {
    const p = service.extrato({ status: ['6-Concluída'], rns: ['138935'], sigla: ['FAT'] });
    const req = http.expectOne((r) => r.url === `${base}/extrato`);
    expect(req.request.params.getAll('status')).toEqual(['6-Concluída']);
    expect(req.request.params.getAll('rns')).toEqual(['138935']);
    req.flush({ data: { filtros: {}, selecionados: {} } });
    await p;
  });

  // Blindagem: o navegador pode estar com bundle mais novo que o processo no ar.
  it('completa listas ausentes do resumo em vez de deixar undefined', async () => {
    const p = service.resumo();
    const req = http.expectOne((r) => r.url === `${base}/resumo`);
    // payload de uma versão ANTIGA do backend: sem `rns` e sem os agrupamentos
    req.flush({
      data: {
        filtros: { grupos: ['G1'], status: [], tecnicos: [], ativos: [], tiposCliente: [] },
        selecionados: {},
      },
    });
    const r = await p;
    expect(r.filtros.rns).toEqual([]);
    expect(r.filtros.grupos).toEqual(['G1']);
    expect(r.selecionados.status).toEqual([]);
    expect(r.linhas).toEqual([]);
    expect(r.porStatus).toEqual([]);
  });

  it('completa listas ausentes do extrato', async () => {
    const p = service.extrato();
    const req = http.expectOne((r) => r.url === `${base}/extrato`);
    req.flush({ data: { filtros: { siglas: ['FAT'] } } });
    const r = await p;
    expect(r.filtros.rns).toEqual([]);
    expect(r.filtros.status).toEqual([]);
    expect(r.filtros.siglas).toEqual(['FAT']);
    expect(r.linhas).toEqual([]);
  });

  it('busca a descrição completa pelo par protocolo + data/hora', async () => {
    const p = service.descricao(1435877, '2026-07-29 10:35');
    const req = http.expectOne((r) => r.url === `${base}/extrato/descricao`);
    expect(req.request.params.get('protocolo')).toBe('1435877');
    expect(req.request.params.get('datahora')).toBe('2026-07-29 10:35');
    req.flush({ data: { descricao: 'texto', tamanho: 5, erro: null } });
    expect((await p).descricao).toBe('texto');
  });
});
