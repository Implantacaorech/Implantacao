import { textoAparado, textoDe } from './texto.util';

describe('textoDe — conversão segura de valor sem tipo', () => {
  it('devolve string vazia para nulo e indefinido', () => {
    expect(textoDe(null)).toBe('');
    expect(textoDe(undefined)).toBe('');
  });

  it('preserva escalares', () => {
    expect(textoDe('Sandri')).toBe('Sandri');
    expect(textoDe(4521)).toBe('4521');
    expect(textoDe(0)).toBe('0');
    expect(textoDe(false)).toBe('false');
  });

  it('nunca produz "[object Object]"', () => {
    // É o ponto do util: um LOB do Oracle ou uma célula rica do Excel viraria esse literal
    // e seria gravado como se fosse o nome do técnico ou da competência.
    expect(textoDe({ lob: true })).toBe('');
    expect(textoDe([1, 2])).toBe('');
    expect(textoDe(() => 1)).toBe('');
  });

  it('mantém a data em formato estável', () => {
    expect(textoDe(new Date(Date.UTC(2026, 6, 21)))).toBe(
      '2026-07-21T00:00:00.000Z',
    );
  });

  it('textoAparado remove espaços das pontas', () => {
    expect(textoAparado('  Vendas  ')).toBe('Vendas');
    expect(textoAparado(null)).toBe('');
  });
});
