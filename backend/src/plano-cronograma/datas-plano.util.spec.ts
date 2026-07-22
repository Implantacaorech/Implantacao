import {
  formatarBr,
  parseDataPlano,
  proximoUtil,
  somarUteis,
} from './datas-plano.util';

describe('datas-plano.util', () => {
  describe('parseDataPlano', () => {
    it('aceita AAAA-MM-DD', () => {
      expect(formatarBr(parseDataPlano('2026-08-10'))).toBe('10/08/2026');
    });

    it('aceita DD/MM/AAAA', () => {
      expect(formatarBr(parseDataPlano('10/08/2026'))).toBe('10/08/2026');
    });

    it('cai em hoje quando o valor é vazio/irreconhecível', () => {
      const hoje = new Date();
      const esperado = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
      expect(formatarBr(parseDataPlano(''))).toBe(esperado);
      expect(formatarBr(parseDataPlano('lixo'))).toBe(esperado);
    });
  });

  describe('proximoUtil', () => {
    it('mantém um dia útil como está', () => {
      // 2026-08-10 é uma segunda-feira.
      expect(formatarBr(proximoUtil(parseDataPlano('2026-08-10')))).toBe(
        '10/08/2026',
      );
    });

    it('pula sábado/domingo para a segunda seguinte', () => {
      // 2026-08-15 é um sábado.
      expect(formatarBr(proximoUtil(parseDataPlano('2026-08-15')))).toBe(
        '17/08/2026',
      );
    });
  });

  describe('somarUteis', () => {
    it('soma dias úteis pulando fins de semana', () => {
      // 2026-08-10 (segunda) + 5 dias úteis = 2026-08-17 (segunda seguinte).
      expect(formatarBr(somarUteis(parseDataPlano('2026-08-10'), 5))).toBe(
        '17/08/2026',
      );
    });
  });
});
