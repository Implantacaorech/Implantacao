import {
  gerarBuffer,
  montarDocumento,
  templateExiste,
} from './gerar-termo-encerramento';
import {
  SnapshotDocx,
  carregarSnapshotDocx,
  extrairDocx,
} from './comparacao-docx';

/** Prova de EQUIVALÊNCIA do porte (§4.7 dos Padrões da Rech, passo 4) contra o snapshot
 * extraído do gerador Python (`tools/caracterizacao/gerar_termo_encerramento.json`).
 *
 * Diferente dos demais, este gerador só existe para produzir um documento FIEL ao template
 * oficial da Rech — por isso o teste cobre também cabeçalhos e rodapés (o timbre). Comparar
 * apenas o corpo deixaria passar justamente o erro que mais importa aqui. */
describe('gerar-termo-encerramento (porte de tools/gerar_termo_encerramento.py)', () => {
  const esperado = carregarSnapshotDocx('gerar_termo_encerramento');
  let atual: SnapshotDocx;

  beforeAll(async () => {
    atual = await extrairDocx(await gerarBuffer());
  });

  it('reproduz cada parágrafo do corpo, na ordem', () => {
    expect(atual.paragrafos).toEqual(esperado.paragrafos);
  });

  it('reproduz a tabela de resumo por módulo, célula a célula', () => {
    expect(atual.tabelas).toEqual(esperado.tabelas);
  });

  it('preserva os cabeçalhos do template oficial (o timbre da Rech)', () => {
    expect(Object.keys(atual.cabecalhos)).toEqual(
      Object.keys(esperado.cabecalhos),
    );
    expect(atual.cabecalhos).toEqual(esperado.cabecalhos);
  });

  it('preserva os rodapés do template oficial', () => {
    expect(Object.keys(atual.rodapes)).toEqual(Object.keys(esperado.rodapes));
    expect(atual.rodapes).toEqual(esperado.rodapes);
  });

  it('escreve o glifo do marcador como TEXTO, não como lista do Word', () => {
    // O template da Rech não tem o estilo "List Bullet"; o original cai no fallback e o
    // "•  " passa a fazer parte do conteúdo. Um porte que usasse lista de verdade perderia
    // o glifo do texto e divergiria do documento real.
    const marcadores = atual.paragrafos.filter((p) => p.startsWith('•  '));
    expect(marcadores.length).toBe(8);
    expect(marcadores[0]).toContain('setor de Suporte da Rech®');
  });

  it('sem pendências informadas, declara que não há pontos a sequenciar', () => {
    const doc = montarDocumento({ cliente: 'X', pendencias: [] });
    expect(doc).toBeDefined();
    expect(atual.paragrafos).toContain(
      'Não há pendências a serem sequenciadas após o encerramento do projeto.',
    );
  });

  it('depende do template oficial — sua ausência muda o documento gerado', () => {
    expect(templateExiste()).toBe(true);
  });
});
