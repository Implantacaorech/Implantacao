import { Packer } from 'docx';
import { montarDocumento } from './gerar-aceite-uat';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_aceite_uat.json`). */
describe('gerar-aceite-uat (porte de tools/gerar_aceite_uat.py)', () => {
  const esperado = carregarSnapshotDocx('gerar_aceite_uat');
  let atual: SnapshotDocx;

  beforeAll(async () => {
    atual = await extrairDocx(await Packer.toBuffer(montarDocumento()));
  });

  it('produz a mesma quantidade de parágrafos no corpo', () => {
    expect(atual.paragrafos.length).toBe(esperado.paragrafos.length);
  });

  it('reproduz cada parágrafo do corpo, na ordem', () => {
    expect(atual.paragrafos).toEqual(esperado.paragrafos);
  });

  it('reproduz as tabelas, célula a célula', () => {
    expect(atual.tabelas).toEqual(esperado.tabelas);
  });

  it('lista uma linha por módulo do escopo, com a contagem de casos', () => {
    // A tabela por módulo tem cabeçalho + uma linha por módulo; a coluna "Casos" é a
    // contagem, e Aprovados/Reprovados/Pendentes ficam em branco para preenchimento manual.
    const porModulo = atual.tabelas[1];
    expect(porModulo[0]).toEqual([
      'Módulo',
      'Casos',
      'Aprovados',
      'Reprovados',
      'Pendentes',
    ]);
    for (const linha of porModulo.slice(1)) {
      expect(linha[1]).toMatch(/^\d+$/);
      expect(linha.slice(2)).toEqual(['', '', '']);
    }
  });

  it('mantém o gate da virada entre os critérios de liberação', () => {
    expect(atual.paragrafos).toContain(
      '≥ 95% dos casos UAT com status Aprovado.',
    );
    expect(atual.paragrafos).toContain(
      'Zero defeitos de severidade Crítica em aberto.',
    );
  });
});
