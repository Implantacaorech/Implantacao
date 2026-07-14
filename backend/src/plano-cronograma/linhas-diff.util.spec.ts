import { diffLinhas } from './linhas-diff.util';

describe('diffLinhas', () => {
  it('detecta campo alterado numa linha existente', () => {
    const antigas = [{ etapa: 'A', topicos: 'x', status: 'Previsto' }];
    const novas = [{ etapa: 'A', topicos: 'x', status: 'Concluído' }];
    const diffs = diffLinhas(antigas, novas, ['etapa', 'topicos', 'status'], ['etapa', 'topicos']);
    expect(diffs).toEqual([{ ref: 'linha 1 · status', campo: 'status', de: 'Previsto', para: 'Concluído' }]);
  });

  it('nenhuma diferença quando as linhas são idênticas', () => {
    const antigas = [{ a: '1', b: '2' }];
    const novas = [{ a: '1', b: '2' }];
    expect(diffLinhas(antigas, novas, ['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('linha nova (mais linhas em `novas` do que em `antigas`)', () => {
    const antigas: Record<string, string>[] = [];
    const novas = [{ etapa: 'Nova etapa', topicos: 'tópicos' }];
    const diffs = diffLinhas(antigas, novas, ['etapa', 'topicos'], ['etapa', 'topicos']);
    expect(diffs).toEqual([
      { ref: 'linha 1', campo: 'linha', de: '(nova)', para: 'Nova etapa · tópicos' },
    ]);
  });

  it('linha removida (mais linhas em `antigas` do que em `novas`)', () => {
    const antigas = [{ etapa: 'Vai sair', topicos: 'x' }];
    const novas: Record<string, string>[] = [];
    const diffs = diffLinhas(antigas, novas, ['etapa', 'topicos'], ['etapa', 'topicos']);
    expect(diffs).toEqual([
      { ref: 'linha 1', campo: 'linha', de: 'Vai sair · x', para: '(removida)' },
    ]);
  });

  it('resumo cai em "(linha vazia)" quando os campos de resumo estão vazios', () => {
    const antigas = [{ etapa: '', topicos: '' }];
    const novas: Record<string, string>[] = [];
    const diffs = diffLinhas(antigas, novas, ['etapa', 'topicos'], ['etapa', 'topicos']);
    expect(diffs[0].de).toBe('(linha vazia)');
  });

  it('quirk conhecida e preservada de propósito: inserir uma linha no meio desloca o diff de todas as seguintes', () => {
    const antigas = [
      { etapa: 'A', topicos: 'ta' },
      { etapa: 'B', topicos: 'tb' },
    ];
    const novas = [
      { etapa: 'A', topicos: 'ta' },
      { etapa: 'NOVA', topicos: 'tn' },
      { etapa: 'B', topicos: 'tb' },
    ];
    const diffs = diffLinhas(antigas, novas, ['etapa', 'topicos'], ['etapa', 'topicos']);
    // comparação posicional: linha 2 "muda" de B pra NOVA, e linha 3 é tratada como nova
    // (mesmo a "B" original só tendo se deslocado, não mudado de conteúdo).
    expect(diffs).toEqual([
      { ref: 'linha 2 · etapa', campo: 'etapa', de: 'B', para: 'NOVA' },
      { ref: 'linha 2 · topicos', campo: 'topicos', de: 'tb', para: 'tn' },
      { ref: 'linha 3', campo: 'linha', de: '(nova)', para: 'B · tb' },
    ]);
  });
});
