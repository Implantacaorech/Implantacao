/** Provedores de IA suportados.
 *
 * - `anthropic` — SDK oficial.
 * - `openrouter` — openrouter.ai, API compatível com a da OpenAI (base fixa
 *   `https://openrouter.ai/api/v1`).
 * - `local` — **qualquer endpoint compatível com a API da OpenAI**, com a URL informada por
 *   quem configura: Ollama (`http://host:11434/v1`), LM Studio (`http://host:1234/v1`),
 *   vLLM, ou o endpoint de compatibilidade de outro provedor.
 *
 * O `local` existe por uma razão de PRIVACIDADE, não de preço: o conteúdo que a IA lê aqui é
 * transcrição de reunião de cliente e descrição dos processos dele. A transcrição já roda na
 * própria rede de propósito (faster-whisper local, "o áudio não sai da rede"); mandar o TEXTO
 * para um endpoint gratuito que treina com o que recebe desfaria essa decisão pela porta dos
 * fundos. Com `local`, o dado não sai da rede em nenhuma etapa. */
export type ProvedorIa = 'anthropic' | 'openrouter' | 'local';

export const PROVEDORES_IA: ProvedorIa[] = ['anthropic', 'openrouter', 'local'];

/** Cada uso de IA no Painel é uma "finalidade" com chave/provedor/modelo PRÓPRIOS — o usuário
 * pediu campos separados por finalidade, não uma chave global compartilhada. */
export type FinalidadeIa = 'protocolos' | 'dicionario' | 'levantamento';

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
  {
    id: 'levantamento',
    rotulo: 'Levantamento a partir da reunião',
    descricao:
      'Sugere as respostas do questionário de Levantamento a partir da transcrição da ' +
      'reunião gravada. As sugestões nunca são gravadas sozinhas — quem responde é o GCI.',
  },
];

export const FINALIDADE_IDS: FinalidadeIa[] = FINALIDADES_IA.map((f) => f.id);

// Modelo padrão quando o provedor é Anthropic e o usuário não informou um. Para OpenRouter não
// há padrão seguro (o id do modelo é do catálogo do provedor, ex.: `anthropic/claude-sonnet-4`),
// então a chave OpenRouter exige que o modelo seja informado.
export const MODELO_ANTHROPIC_PADRAO = 'claude-opus-4-8';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
