import { custoEstimadoUsd } from './precos-ia';

describe('custoEstimadoUsd (A9)', () => {
  it('estima o custo de um modelo conhecido pela tabela', () => {
    // gpt-4o-mini: 0.15/1M entrada, 0.60/1M saída.
    const c = custoEstimadoUsd(
      'openrouter',
      'openai/gpt-4o-mini',
      1_000_000,
      1_000_000,
    );
    expect(c).toBeCloseTo(0.15 + 0.6, 6);
  });

  it('soma entrada e saída proporcionalmente aos tokens', () => {
    const c = custoEstimadoUsd(
      'openrouter',
      'openai/gpt-4o-mini',
      500_000,
      250_000,
    );
    expect(c).toBeCloseTo(0.15 * 0.5 + 0.6 * 0.25, 6);
  });

  it('provedor local custa 0 (auto-hospedado)', () => {
    expect(custoEstimadoUsd('local', 'qwen2.5:14b', 1000, 1000)).toBe(0);
  });

  it('modelo desconhecido → null (tokens continuam sendo contados fora daqui)', () => {
    expect(
      custoEstimadoUsd('openrouter', 'modelo/inexistente', 100, 100),
    ).toBeNull();
  });

  it('sem tokens (usage ausente) em modelo conhecido → null', () => {
    expect(
      custoEstimadoUsd('anthropic', 'claude-opus-4-8', null, null),
    ).toBeNull();
  });

  it('conta o custo mesmo com só um lado de tokens', () => {
    const c = custoEstimadoUsd('anthropic', 'claude-opus-4-8', 1_000_000, null);
    expect(c).toBeCloseTo(5, 6);
  });
});
