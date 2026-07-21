import { montarWorkbook } from './gerar-reconciliacao-conversao';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_reconciliacao_conversao.json`). */
describe('gerar-reconciliacao-conversao (porte de tools/gerar_reconciliacao_conversao.py)', () => {
  const esperado = carregarSnapshot('gerar_reconciliacao_conversao');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('mantém as fórmulas de diferença por linha (qtd e valor)', () => {
    const rec = atual.abas['Reconciliação'];
    expect(rec[1][5]).toBe('=E2-D2');
    expect(rec[1][8]).toBe('=H2-G2');
  });
});
