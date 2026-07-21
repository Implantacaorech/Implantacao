import { montarWorkbook } from './gerar-painel-kpi';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python original (`tools/caracterizacao/gerar_painel_kpi.json`). */
describe('gerar-painel-kpi (porte de tools/gerar_painel_kpi.py)', () => {
  const esperado = carregarSnapshot('gerar_painel_kpi');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('preserva as fórmulas de desvio e de total, que são o cálculo da planilha', () => {
    const marcos = atual.abas['Marcos (Prazo)'];
    expect(marcos[1][3]).toBe('=IF(AND(B2<>"",C2<>""),C2-B2,"")');
    const horas = atual.abas['Horas (Plan x Real)'];
    expect(horas[horas.length - 1][1]).toMatch(/^=SUM\(B2:B\d+\)$/);
  });
});
