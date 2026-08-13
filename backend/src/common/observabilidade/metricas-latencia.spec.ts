import { metricasLatencia } from './metricas-latencia';

describe('metricasLatencia (eixo 9)', () => {
  beforeEach(() => metricasLatencia._resetar());

  it('agrega por rota com chamadas, média, p95 e máximo', () => {
    metricasLatencia.registrar('GET /x', 10);
    metricasLatencia.registrar('GET /x', 30);
    metricasLatencia.registrar('GET /x', 20);
    const x = metricasLatencia.resumo().find((i) => i.rota === 'GET /x')!;
    expect(x.chamadas).toBe(3);
    expect(x.mediaMs).toBe(20);
    expect(x.maxMs).toBe(30);
    expect(x.p95Ms).toBe(30);
  });

  it('ordena da rota mais lenta (p95) para a mais rápida', () => {
    metricasLatencia.registrar('GET /rapido', 5);
    metricasLatencia.registrar('GET /lento', 500);
    expect(metricasLatencia.resumo()[0].rota).toBe('GET /lento');
  });

  it('separa por método + rota', () => {
    metricasLatencia.registrar('GET /a', 10);
    metricasLatencia.registrar('POST /a', 10);
    expect(metricasLatencia.resumo().length).toBe(2);
  });

  it('preserva a CONTAGEM total mas limita as amostras (não cresce sem teto)', () => {
    for (let i = 0; i < 500; i++) metricasLatencia.registrar('GET /flood', i);
    const x = metricasLatencia.resumo().find((i) => i.rota === 'GET /flood')!;
    expect(x.chamadas).toBe(500); // a contagem não é amostrada
    // o p95 sai das ÚLTIMAS 200 amostras (300..499) — bem acima de 400.
    expect(x.p95Ms).toBeGreaterThan(400);
  });
});
