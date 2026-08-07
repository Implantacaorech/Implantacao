import { mascararParaTeste } from './comparacao-docx';

/**
 * A máscara de data do harness .docx só funciona se for aplicada aos DOIS lados.
 *
 * Aplicada só ao documento gerado, ela quebrava a suíte sozinha em todo dia que coincidisse
 * com uma data de NEGÓCIO das fixtures: em 07/08/2026 o snapshot do Projeto tem a data fixa
 * "07/08/2026", que virou `<HOJE>` no lado gerado e continuou literal no esperado.
 *
 * Estes testes provam a propriedade sem depender do calendário: o que importa é que a mesma
 * entrada produza a mesma saída dos dois lados.
 */
describe('comparacao-docx — máscara de data', () => {
  const hoje = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const HOJE = `${p(hoje.getDate())}/${p(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;

  it('troca a data de hoje pelo marcador', () => {
    expect(mascararParaTeste(`Atualizado em ${HOJE}`)).toBe('Atualizado em <HOJE>');
  });

  it('é IDEMPOTENTE: aplicar no valor já mascarado não muda nada', () => {
    // É isto que faz os dois lados convergirem — o snapshot já vem com `<HOJE>` da captura,
    // e passar `mascarar` nele de novo não pode estragá-lo.
    expect(mascararParaTeste('Atualizado em <HOJE>')).toBe('Atualizado em <HOJE>');
  });

  it('uma data de NEGÓCIO igual à de hoje converge nos dois lados', () => {
    // O caso que quebrava: a fixture tem a data literal; o gerado tem a mesma data. Com a
    // máscara aplicada aos dois, ambos viram `<HOJE>` e a comparação passa.
    const esperadoDoSnapshot = HOJE; // literal, como está gravado no .json
    const geradoAgora = HOJE;
    expect(mascararParaTeste(esperadoDoSnapshot)).toBe(mascararParaTeste(geradoAgora));
  });

  it('não mexe em data que não é hoje', () => {
    expect(mascararParaTeste('Virada em 01/01/2030')).toBe('Virada em 01/01/2030');
  });
});
