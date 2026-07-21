import { montarWorkbook } from './gerar-raid';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4): a saída do gerador em
 * Node/TypeScript tem de reproduzir o conteúdo do gerador Python original, medido pelo
 * contrato observável capturado em `tools/caracterizacao/gerar_raid.json`. */
describe('gerar-raid (porte de tools/gerar_raid.py)', () => {
  const esperado = carregarSnapshot('gerar_raid');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem, que o gerador Python', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('mantém os IDs numerados como o original (R-01, A-01, DP-01…)', () => {
    expect(atual.abas['Riscos'][1][0]).toBe('R-01');
    expect(atual.abas['Premissas'][1][0]).toBe('A-01');
    expect(atual.abas['Dependências'][1][0]).toBe('DP-01');
  });
});
