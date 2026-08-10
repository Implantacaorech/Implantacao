import { Workbook } from 'exceljs';
import { extrairXlsx } from './comparacao';

/** A máscara `<HOJE>` do harness de equivalência (§4.7 dos Padrões da Rech).
 *
 * Estes testes existem por uma quebra real: em 02/08/2026 a suíte dos geradores começou a
 * falhar sozinha, sem ninguém ter tocado no código. A máscara trocava QUALQUER célula igual
 * à data de hoje, e o dia 2 do hypercare da fixture (janela iniciando em 01/08/2026) calhou
 * de ser hoje — virou `<HOJE>` e deixou de bater com o snapshot.
 *
 * O contrato correto é o que o comentário do próprio harness já dizia: sai só a data de
 * GERAÇÃO; data de NEGÓCIO fica, porque é nela que um erro de aritmética apareceria. */
describe('máscara de data no harness de equivalência', () => {
  const hoje = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  })();

  function planilhaCom(...celulas: string[]) {
    const wb = new Workbook();
    const ws = wb.addWorksheet('Teste');
    celulas.forEach((texto, i) => {
      ws.getCell(i + 1, 1).value = texto;
    });
    return extrairXlsx(wb).abas['Teste'].map((l) => l[0]);
  }

  it('mascara a data de geração (vem atrás do rótulo)', () => {
    expect(planilhaCom(`Indústria Alfa Ltda · gerado em ${hoje}`)).toEqual([
      'Indústria Alfa Ltda · gerado em <HOJE>',
    ]);
  });

  it('mascara também "Atualizado em", usado pelo dossiê', () => {
    expect(planilhaCom(`Atualizado em ${hoje}`)).toEqual([
      'Atualizado em <HOJE>',
    ]);
  });

  it('NÃO mascara data de negócio que por acaso seja hoje', () => {
    // O caso que quebrou a suíte: dia do hypercare/virada/prazo coincidindo com hoje.
    expect(planilhaCom(hoje)).toEqual([hoje]);
    expect(planilhaCom(`Virada: ${hoje}`)).toEqual([`Virada: ${hoje}`]);
  });

  it('não mexe em data que não é hoje', () => {
    expect(planilhaCom('gerado em 01/01/2020')).toEqual([
      'gerado em 01/01/2020',
    ]);
  });
});
