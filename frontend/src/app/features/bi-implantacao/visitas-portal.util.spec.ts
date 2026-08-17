import { dentroDaVisao } from './visitas-portal.util';

/** O recorte é puro e recebe "hoje" por parâmetro — dá para testar com data fixa
 * (17/08/2026 é uma segunda-feira; a semana dela vai até domingo 23/08). */
describe('dentroDaVisao (visão do gráfico de visitas do Portal)', () => {
  it('geral aceita qualquer data (até vazia — a linha aparece na tabela de todo jeito)', () => {
    expect(dentroDaVisao('2020-01-01', 'geral', '2026-08-17')).toBe(true);
    expect(dentroDaVisao('', 'geral', '2026-08-17')).toBe(true);
  });

  it('mensal = mesmo mês de hoje', () => {
    expect(dentroDaVisao('2026-08-01', 'mensal', '2026-08-17')).toBe(true);
    expect(dentroDaVisao('2026-08-31', 'mensal', '2026-08-17')).toBe(true);
    expect(dentroDaVisao('2026-07-31', 'mensal', '2026-08-17')).toBe(false);
    expect(dentroDaVisao('', 'mensal', '2026-08-17')).toBe(false);
  });

  it('semanal = segunda a domingo da semana de hoje', () => {
    // hoje = quarta 19/08 → semana de segunda 17/08 a domingo 23/08
    expect(dentroDaVisao('2026-08-17', 'semanal', '2026-08-19')).toBe(true);
    expect(dentroDaVisao('2026-08-23', 'semanal', '2026-08-19')).toBe(true);
    expect(dentroDaVisao('2026-08-16', 'semanal', '2026-08-19')).toBe(false);
    expect(dentroDaVisao('2026-08-24', 'semanal', '2026-08-19')).toBe(false);
  });

  it('no domingo, a semana ainda é a INICIADA na segunda anterior', () => {
    expect(dentroDaVisao('2026-08-17', 'semanal', '2026-08-23')).toBe(true);
    expect(dentroDaVisao('2026-08-24', 'semanal', '2026-08-23')).toBe(false);
  });
});
