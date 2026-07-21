import { montarWorkbook } from './gerar-kit-mudanca';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_kit_mudanca.json`). */
describe('gerar-kit-mudanca (porte de tools/gerar_kit_mudanca.py)', () => {
  const esperado = carregarSnapshot('gerar_kit_mudanca');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('monta as colunas do ADKAR a partir das dimensões do YAML', () => {
    const cabecalho = atual.abas['Prontidão (ADKAR)'][0];
    expect(cabecalho[0]).toBe('Grupo / Área');
    expect(cabecalho[cabecalho.length - 1]).toBe('Ações de reforço');
  });
});
