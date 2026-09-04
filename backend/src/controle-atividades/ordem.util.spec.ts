import {
  INTERVALO_MINIMO,
  PASSO_ORDEM,
  ordemEntre,
  precisaRenumerar,
  renumerar,
  sequenciaCom,
} from './ordem.util';

describe('ordenação por ponto médio', () => {
  it('lista vazia começa no passo', () => {
    expect(ordemEntre(null, null)).toBe(PASSO_ORDEM);
  });

  it('no fim da lista, soma o passo ao último', () => {
    expect(ordemEntre(2048, null)).toBe(2048 + PASSO_ORDEM);
  });

  it('no início da lista, subtrai o passo do primeiro', () => {
    expect(ordemEntre(null, 1024)).toBe(1024 - PASSO_ORDEM);
  });

  it('entre dois, fica na média', () => {
    expect(ordemEntre(1000, 2000)).toBe(1500);
  });

  it('a ordem gerada fica ESTRITAMENTE entre os vizinhos', () => {
    const a = 0;
    let b = PASSO_ORDEM;
    for (let i = 0; i < 20; i += 1) {
      const meio = ordemEntre(a, b);
      expect(meio).toBeGreaterThan(a);
      expect(meio).toBeLessThan(b);
      b = meio; // insere sempre no mesmo ponto, o pior caso
    }
  });

  it('avisa quando os vizinhos ficaram próximos demais para dividir de novo', () => {
    expect(precisaRenumerar(1000, 2000)).toBe(false);
    expect(precisaRenumerar(1000, 1000 + INTERVALO_MINIMO / 2)).toBe(true);
  });

  it('não pede renumeração quando falta vizinho (nada a colidir)', () => {
    expect(precisaRenumerar(null, 1000)).toBe(false);
    expect(precisaRenumerar(1000, null)).toBe(false);
  });

  it('renumerar devolve espaçamento regular', () => {
    expect(renumerar(3)).toEqual([
      PASSO_ORDEM,
      2 * PASSO_ORDEM,
      3 * PASSO_ORDEM,
    ]);
    expect(renumerar(0)).toEqual([]);
  });

  describe('sequenciaCom', () => {
    const itens = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('coloca o item na posição pedida', () => {
      expect(sequenciaCom(itens, 3, 0)).toEqual([3, 1, 2]);
      expect(sequenciaCom(itens, 1, 2)).toEqual([2, 3, 1]);
    });

    it('índice além do fim vai para o fim (e não quebra)', () => {
      expect(sequenciaCom(itens, 1, 99)).toEqual([2, 3, 1]);
      expect(sequenciaCom(itens, 1, -5)).toEqual([1, 2, 3]);
    });
  });
});
