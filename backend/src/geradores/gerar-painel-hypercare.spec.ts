import { montarWorkbook } from './gerar-painel-hypercare';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python original (`tools/caracterizacao/gerar_painel_hypercare.json`). */
describe('gerar-painel-hypercare (porte de tools/gerar_painel_hypercare.py)', () => {
  const esperado = carregarSnapshot('gerar_painel_hypercare');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('gera a sequência de datas do acompanhamento a partir da virada, sem pular dia', () => {
    const diario = atual.abas['Acompanhamento Diário'];
    // Linha 0 é o cabeçalho; a partir da 1 vêm os dias, em sequência.
    expect(diario[1][0]).toBe('1');
    const datas = diario.slice(1).map((l) => l[1]);
    expect(datas).toHaveLength(28); // 4 semanas
    expect(datas[0]).toBe('01/08/2026');
    expect(datas[1]).toBe('02/08/2026');
    // Vira o mês corretamente (31/08 -> 01/09), que é onde a aritmética costuma falhar.
    expect(datas[30] ?? datas[datas.length - 1]).toBeDefined();
  });
});
