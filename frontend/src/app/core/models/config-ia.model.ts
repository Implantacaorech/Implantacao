/** `local` = qualquer endpoint compatível com a API da OpenAI rodando na própria rede
 * (Ollama, LM Studio, vLLM). Existe por privacidade: com ele, a transcrição da reunião do
 * cliente não sai da rede em etapa nenhuma. */
export type ProvedorIa = 'anthropic' | 'openrouter' | 'local';

export interface StatusFinalidadeIa {
  finalidade: string;
  rotulo: string;
  descricao: string;
  ativa: boolean;
  provider: ProvedorIa;
  modelo: string;
  /** Só no provedor `local`: endereço do serviço. Não é segredo (a chave é). */
  baseUrl: string;
  viaEnv: boolean;
}

export interface StatusConfigIa {
  provedores: ProvedorIa[];
  finalidades: StatusFinalidadeIa[];
}

export interface SalvarChaveIa {
  finalidade: string;
  provider: ProvedorIa;
  apiKey: string;
  modelo: string;
  baseUrl: string;
}

export interface ModeloOpenRouter {
  id: string;
  nome: string;
}
