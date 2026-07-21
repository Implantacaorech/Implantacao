import { montarWorkbook } from './gerar-log-fitgap';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python original (`tools/caracterizacao/gerar_log_fitgap.json`). */
describe('gerar-log-fitgap (porte de tools/gerar_log_fitgap.py)', () => {
  const esperado = carregarSnapshot('gerar_log_fitgap');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('mantém as fórmulas do Resumo apontando para a aba do log', () => {
    const resumo = atual.abas['Resumo'];
    expect(resumo[4][1]).toContain("COUNTIF('Log Fit-Gap'!E:E");
  });
});
