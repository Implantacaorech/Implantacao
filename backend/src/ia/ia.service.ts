import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  FINALIDADES_IA,
  FinalidadeIa,
  MODELO_ANTHROPIC_PADRAO,
  OPENROUTER_BASE_URL,
  ProvedorIa,
} from './ia.constants';

export interface ConfigFinalidade {
  provider: ProvedorIa;
  apiKey: string;
  modelo: string;
}

export interface StatusFinalidade {
  finalidade: FinalidadeIa;
  rotulo: string;
  descricao: string;
  ativa: boolean;
  provider: ProvedorIa;
  modelo: string;
  viaEnv: boolean;
}

export interface MensagemIa {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpcoesCompletar {
  system: string;
  messages: MensagemIa[];
  maxTokens: number;
}

type ArquivoConfig = Partial<Record<FinalidadeIa, ConfigFinalidade>>;

/** Configuração de IA por FINALIDADE (Protocolos, Dicionário…). Cada finalidade tem
 * chave/provedor/modelo próprios — o usuário pediu campos separados, não uma chave global.
 * Provedores: `anthropic` (SDK oficial) e `openrouter` (openrouter.ai, API compatível com a
 * da OpenAI). Chaves ficam em `dados/ia_config.json` (fora do Git), NUNCA no banco.
 *
 * Compatibilidade: a variável de ambiente `MIGRACAO_ANTHROPIC_API_KEY` (e o arquivo legado
 * `dados/anthropic_key.txt`) continuam valendo como fallback Anthropic para qualquer
 * finalidade sem configuração própria — setups antigos seguem funcionando sem migração. */
@Injectable()
export class IaService {
  private arquivoConfig(): string {
    // Isolado por JEST_WORKER_ID em teste (mesmo motivo/corrida EBUSY de modelo-documento).
    if (process.env.NODE_ENV === 'test') {
      return join(
        process.cwd(),
        'dados',
        `ia_config_test_${process.env.JEST_WORKER_ID ?? '0'}.json`,
      );
    }
    return join(process.cwd(), 'dados', 'ia_config.json');
  }

  private arquivoChaveLegado(): string {
    if (process.env.NODE_ENV === 'test') {
      return join(
        process.cwd(),
        'dados',
        `anthropic_key_test_${process.env.JEST_WORKER_ID ?? '0'}.txt`,
      );
    }
    return join(process.cwd(), 'dados', 'anthropic_key.txt');
  }

  private lerArquivo(): ArquivoConfig {
    try {
      const bruto = readFileSync(this.arquivoConfig(), 'utf8');
      const parsed = JSON.parse(bruto) as ArquivoConfig;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private gravarArquivo(config: ArquivoConfig): void {
    mkdirSync(join(process.cwd(), 'dados'), { recursive: true });
    writeFileSync(
      this.arquivoConfig(),
      JSON.stringify(config, null, 2),
      'utf8',
    );
  }

  /** Fallback global Anthropic (env var ou arquivo legado) — vale para qualquer finalidade
   * sem configuração própria. Retorna null se não houver. */
  private fallbackAnthropic(): {
    apiKey: string;
    modelo: string;
    viaEnv: boolean;
  } | null {
    const env =
      process.env.MIGRACAO_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (env) {
      return {
        apiKey: env.trim(),
        modelo:
          process.env.MIGRACAO_ANTHROPIC_MODELO ?? MODELO_ANTHROPIC_PADRAO,
        viaEnv: true,
      };
    }
    try {
      const legado = readFileSync(this.arquivoChaveLegado(), 'utf8').trim();
      if (legado) {
        return {
          modelo:
            process.env.MIGRACAO_ANTHROPIC_MODELO ?? MODELO_ANTHROPIC_PADRAO,
          apiKey: legado,
          viaEnv: false,
        };
      }
    } catch {
      /* sem arquivo legado */
    }
    return null;
  }

  /** Configuração efetiva de uma finalidade (própria, senão o fallback global). */
  private resolver(
    finalidade: FinalidadeIa,
  ): { config: ConfigFinalidade; viaEnv: boolean } | null {
    const propria = this.lerArquivo()[finalidade];
    if (propria?.apiKey) {
      return { config: propria, viaEnv: false };
    }
    const fallback = this.fallbackAnthropic();
    if (fallback) {
      return {
        config: {
          provider: 'anthropic',
          apiKey: fallback.apiKey,
          modelo: fallback.modelo,
        },
        viaEnv: fallback.viaEnv,
      };
    }
    return null;
  }

  disponivel(finalidade: FinalidadeIa): boolean {
    return this.resolver(finalidade) !== null;
  }

  status(finalidade: FinalidadeIa): StatusFinalidade {
    const def = FINALIDADES_IA.find((f) => f.id === finalidade)!;
    const resolvido = this.resolver(finalidade);
    return {
      finalidade,
      rotulo: def.rotulo,
      descricao: def.descricao,
      ativa: resolvido !== null,
      provider: resolvido?.config.provider ?? 'anthropic',
      modelo: resolvido?.config.modelo ?? '',
      viaEnv: resolvido?.viaEnv ?? false,
    };
  }

  statusTodas(): StatusFinalidade[] {
    return FINALIDADES_IA.map((f) => this.status(f.id));
  }

  /** Salva (ou remove, se apiKey vazia) a configuração de uma finalidade. */
  salvar(finalidade: FinalidadeIa, dados: Partial<ConfigFinalidade>): void {
    const config = this.lerArquivo();
    const apiKey = (dados.apiKey ?? '').trim();
    if (!apiKey) {
      delete config[finalidade];
    } else {
      const provider: ProvedorIa =
        dados.provider === 'openrouter' ? 'openrouter' : 'anthropic';
      const modelo =
        (dados.modelo ?? '').trim() ||
        (provider === 'anthropic' ? MODELO_ANTHROPIC_PADRAO : '');
      config[finalidade] = { provider, apiKey, modelo };
    }
    this.gravarArquivo(config);
  }

  /** Executa uma completude de chat para a finalidade, no provedor configurado. */
  async completar(
    finalidade: FinalidadeIa,
    opcoes: OpcoesCompletar,
  ): Promise<string> {
    const resolvido = this.resolver(finalidade);
    if (!resolvido) {
      throw new Error(
        `IA não configurada para a finalidade "${finalidade}" (Config → IA).`,
      );
    }
    const { config } = resolvido;
    if (config.provider === 'openrouter') {
      return this.completarOpenRouter(config, opcoes);
    }
    return this.completarAnthropic(config, opcoes);
  }

  private async completarAnthropic(
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
  ): Promise<string> {
    const client = new Anthropic({ apiKey: config.apiKey });
    const resp = await client.messages.create({
      model: config.modelo || MODELO_ANTHROPIC_PADRAO,
      max_tokens: opcoes.maxTokens,
      system: opcoes.system,
      messages: opcoes.messages,
    });
    return resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }

  /** OpenRouter usa a API de chat completions compatível com a da OpenAI: o `system` vira a
   * primeira mensagem com role `system`. */
  private async completarOpenRouter(
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
  ): Promise<string> {
    if (!config.modelo) {
      throw new Error(
        'Modelo do OpenRouter não informado (ex.: anthropic/claude-sonnet-4).',
      );
    }
    const resp = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.modelo,
        max_tokens: opcoes.maxTokens,
        messages: [
          { role: 'system', content: opcoes.system },
          ...opcoes.messages,
        ],
      }),
    });
    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '');
      throw new Error(
        `OpenRouter respondeu ${resp.status}: ${detalhe.slice(0, 300)}`,
      );
    }
    const dados = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return dados.choices?.[0]?.message?.content ?? '';
  }
}
