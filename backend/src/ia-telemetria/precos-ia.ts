/**
 * Tabela de preços de IA por modelo (USD por 1 milhão de tokens). Serve para ESTIMAR o custo
 * de cada chamada a partir do `usage` do provedor (achado A9). É uma aproximação de
 * acompanhamento, não contabilidade — preços de tabela pública, que mudam; por isso o custo é
 * `float` e "estimado".
 *
 * Modelo sem preço conhecido → custo `null` (a telemetria ainda registra os tokens). Provedor
 * `local` → custo 0 (auto-hospedado, não há cobrança por token).
 *
 * ⚠️ Ao trocar de modelo em Config → IA, confira se ele está aqui; senão o custo sai `null`
 * (tokens continuam contados). Atualizar esta tabela é a forma de manter a estimativa fiel.
 */
export interface PrecoModelo {
  /** USD por 1M tokens de ENTRADA (prompt). */
  entrada: number;
  /** USD por 1M tokens de SAÍDA (completion). */
  saida: number;
}

/** Chave: id do modelo como aparece na configuração. Cobrimos os modelos que este Painel usa
 * hoje e alguns próximos; o resto cai em `null` de propósito (melhor não estimar do que
 * estimar errado). Valores em USD/1M tokens (tabelas públicas de meados de 2026). */
export const PRECOS_IA: Record<string, PrecoModelo> = {
  // OpenAI (via OpenRouter, prefixo openai/)
  'openai/gpt-4o-mini': { entrada: 0.15, saida: 0.6 },
  'openai/gpt-4o': { entrada: 2.5, saida: 10 },
  // Anthropic (SDK direto, id sem prefixo)
  'claude-opus-4-8': { entrada: 5, saida: 25 },
  'claude-sonnet-4': { entrada: 3, saida: 15 },
  'claude-haiku-4-5-20251001': { entrada: 0.8, saida: 4 },
  // Anthropic via OpenRouter (prefixo anthropic/)
  'anthropic/claude-sonnet-4': { entrada: 3, saida: 15 },
  'anthropic/claude-opus-4-8': { entrada: 5, saida: 25 },
};

/**
 * Custo estimado em USD de uma chamada. `null` quando não dá para estimar (modelo desconhecido
 * ou tokens ausentes). Provedor `local` é sempre 0.
 */
export function custoEstimadoUsd(
  provider: string,
  modelo: string,
  tokensEntrada: number | null,
  tokensSaida: number | null,
): number | null {
  if (provider === 'local') return 0;
  const preco = PRECOS_IA[modelo];
  if (!preco) return null;
  if (tokensEntrada === null && tokensSaida === null) return null;
  const ent = ((tokensEntrada ?? 0) / 1_000_000) * preco.entrada;
  const sai = ((tokensSaida ?? 0) / 1_000_000) * preco.saida;
  return ent + sai;
}
