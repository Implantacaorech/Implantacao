import { contador5xx } from './contador-5xx';

describe('contador5xx (A12)', () => {
  beforeEach(() => contador5xx._resetar());

  it('começa zerado', () => {
    expect(contador5xx.resumo().total24h).toBe(0);
    expect(contador5xx.resumo().ultimo).toBeNull();
  });

  it('conta apenas 5xx (ignora 4xx e faixas fora de 500-599)', () => {
    contador5xx.registrar(500, '/a');
    contador5xx.registrar(404, '/b'); // ignorado
    contador5xx.registrar(503, '/c');
    contador5xx.registrar(200, '/d'); // ignorado
    expect(contador5xx.resumo().total24h).toBe(2);
  });

  it('guarda o último com status, rota e timestamp ISO', () => {
    contador5xx.registrar(500, '/a');
    contador5xx.registrar(502, '/ultimo');
    const u = contador5xx.resumo().ultimo!;
    expect(u.status).toBe(502);
    expect(u.rota).toBe('/ultimo');
    expect(() => new Date(u.em).toISOString()).not.toThrow();
  });

  it('não cresce sem limite (teto de memória)', () => {
    for (let n = 0; n < 700; n++) contador5xx.registrar(500, '/x');
    expect(contador5xx.resumo().total24h).toBeLessThanOrEqual(500);
  });
});
