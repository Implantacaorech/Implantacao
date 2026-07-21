import { montarWorkbook } from './gerar-roteiros-teste';
import { carregarSnapshot, extrairXlsx } from './comparacao';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_roteiros_teste.json`). */
describe('gerar-roteiros-teste (porte de tools/gerar_roteiros_teste.py)', () => {
  const esperado = carregarSnapshot('gerar_roteiros_teste');
  const atual = extrairXlsx(montarWorkbook());

  it('produz as mesmas abas, na mesma ordem (Capa, uma por módulo, defeitos, resumo)', () => {
    expect(atual.abas_ordem).toEqual(esperado.abas_ordem);
  });

  it.each(esperado.abas_ordem)('reproduz o conteúdo da aba %s', (nome) => {
    expect(atual.abas[nome]).toEqual(esperado.abas[nome]);
  });

  it('soma as métricas do resumo sobre TODAS as abas de módulo', () => {
    const resumo = atual.abas['Resumo e Sign-off'];
    const aprovados = resumo[3][1];
    expect(aprovados.startsWith('=')).toBe(true);
    expect(aprovados).toContain('COUNTIF(');
    expect(aprovados).toContain('"Aprovado"');
  });
});
