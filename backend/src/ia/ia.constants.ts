/** Provedores de IA suportados. OpenRouter (openrouter.ai) agrega vários modelos atrás de uma
 * única chave, via API compatível com a da OpenAI (base `https://openrouter.ai/api/v1`). */
export type ProvedorIa = 'anthropic' | 'openrouter';

export const PROVEDORES_IA: ProvedorIa[] = ['anthropic', 'openrouter'];

/** Cada uso de IA no Painel é uma "finalidade" com chave/provedor/modelo PRÓPRIOS — o usuário
 * pediu campos separados por finalidade, não uma chave global compartilhada. */
export type FinalidadeIa = 'protocolos' | 'dicionario';

export interface DefinicaoFinalidade {
  id: FinalidadeIa;
  rotulo: string;
  descricao: string;
}

export const FINALIDADES_IA: DefinicaoFinalidade[] = [
  {
    id: 'protocolos',
    rotulo: 'Transcrição Áudio/Vídeo',
    descricao:
      'Reconferência do texto transcrito (2ª revisão) e estruturação do protocolo.',
  },
  {
    id: 'dicionario',
    rotulo: 'Dicionário Inteligente',
    descricao:
      'Resposta em linguagem natural fundamentada nos documentos do SIGER® (RAG).',
  },
];

export const FINALIDADE_IDS: FinalidadeIa[] = FINALIDADES_IA.map((f) => f.id);

// Modelo padrão quando o provedor é Anthropic e o usuário não informou um. Para OpenRouter não
// há padrão seguro (o id do modelo é do catálogo do provedor, ex.: `anthropic/claude-sonnet-4`),
// então a chave OpenRouter exige que o modelo seja informado.
export const MODELO_ANTHROPIC_PADRAO = 'claude-opus-4-8';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
