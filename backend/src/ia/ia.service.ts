import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { IaTelemetriaService } from '../ia-telemetria/ia-telemetria.service';
import { killSwitch } from '../common/automacao/kill-switch';
import {
  CABECALHO_REQUEST_ID,
  requestIdAtual,
} from '../common/observabilidade/correlacao';
import {
  exigeProvedorLocal,
  FINALIDADES_IA,
  FINALIDADES_SO_LOCAL,
  FinalidadeIa,
  MODELO_ANTHROPIC_PADRAO,
  OPENROUTER_BASE_URL,
  PROVEDORES_IA,
  ProvedorIa,
} from './ia.constants';

/** Tokens consumidos numa chamada — `null` quando o provedor não devolveu `usage`. */
interface UsoIa {
  tokensEntrada: number | null;
  tokensSaida: number | null;
}

/** Enriquecimento opcional para a telemetria (A10): quem disparou e um rótulo de contexto
 * (NUNCA o conteúdo do prompt). Sem isto, a linha ainda registra finalidade/provedor/modelo/
 * tokens/custo — só o "quem" fica como robô/sistema. */
export interface MetaExecucaoIa {
  solicitante?: string | null;
  contexto?: string;
}

/** Teto de espera do serviço local. Generoso porque um modelo grande em CPU lendo 13 mil
 * tokens de transcrição leva minutos — e apertar isso transformaria "lento" em "quebrado".
 * Existir, porém, é obrigatório: sem teto, um servidor engasgado penduraria o pipeline de
 * transcrição para sempre, que é exatamente o defeito corrigido em `aguardarTranscricao`. */
const TIMEOUT_LOCAL_MS = 10 * 60 * 1000;

/** Teto de espera dos provedores REMOTOS (OpenRouter, Anthropic). Menor que o do local porque
 * uma API na nuvem que não respondeu em 2 min está fora do ar, não "pensando devagar em CPU".
 * Achado A14: sem teto, uma chamada pendurada deixava o protocolo preso em `Analisando` para
 * sempre — exatamente o beco que `recuperarPresos`/`cancelar` existem para desfazer. */
const TIMEOUT_REMOTO_MS = 2 * 60 * 1000;
/** Teto curto para consultas auxiliares (catálogo de modelos): é conveniência de tela, não
 * pode segurar a UI se a rede engasgar. */
const TIMEOUT_CATALOGO_MS = 10 * 1000;

/** Temperatura FIXA e baixa para todas as finalidades: são tarefas FACTUAIS (estruturar a
 * transcrição, responder com base no documento, extrair as respostas do questionário), onde
 * criatividade é defeito — quanto mais determinístico, menos alucinação. Eixo 6 da auditoria de
 * 2026-08-12. O caller pode sobrepor via `opcoes.temperatura`, mas o default é factual de
 * propósito. */
const TEMPERATURA_FACTUAL = 0.2;

/** Abaixo deste tamanho de entrada (system + mensagens, em caracteres) a tarefa é considerada
 * SIMPLES e pode ir ao modelo econômico da finalidade, quando houver um configurado — modelo
 * barato para trabalho barato (roteamento por custo, eixo 7). ~4 mil caracteres ≈ 1 mil tokens. */
const LIMIAR_TAREFA_SIMPLES_CHARS = 4000;

export interface ConfigFinalidade {
  provider: ProvedorIa;
  apiKey: string;
  modelo: string;
  /** Só para `local`: URL base do endpoint compatível com a API da OpenAI, com o caminho da
   * versão incluído (ex.: `http://192.168.1.50:11434/v1`). */
  baseUrl?: string;
  /** Modelo BARATO usado quando a tarefa é simples (eixo 7). Opcional — sem ele, a finalidade
   * usa sempre `modelo`. Ex.: `claude-haiku-4-5` / `openai/gpt-4o-mini` / um modelo local menor. */
  modeloEconomico?: string;
}

export interface StatusFinalidade {
  finalidade: FinalidadeIa;
  rotulo: string;
  descricao: string;
  ativa: boolean;
  provider: ProvedorIa;
  modelo: string;
  /** Devolvida para a tela reexibir o que está configurado. Não é segredo — é um endereço
   * de rede interna; a CHAVE é que nunca sai daqui. */
  baseUrl: string;
  viaEnv: boolean;
  /** Modelo econômico configurado para a finalidade (eixo 7), ou '' se não houver. */
  modeloEconomico: string;
}

export interface MensagemIa {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpcoesCompletar {
  system: string;
  messages: MensagemIa[];
  maxTokens: number;
  /** Temperatura da geração; default `TEMPERATURA_FACTUAL` (baixa) — ver eixo 6. */
  temperatura?: number;
  /** Dica de roteamento por custo (eixo 7): `true` força o modelo econômico; `false` força o
   * modelo pleno; ausente = decide pelo tamanho da entrada. */
  tarefaSimples?: boolean;
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
export class IaService implements OnModuleInit {
  private readonly logger = new Logger(IaService.name);

  // Telemetria é OPCIONAL de propósito: em teste o serviço é construído sem DI (construtor
  // direto, sem argumentos), e ali não há telemetria — o registro simplesmente não acontece.
  // Em produção o Nest injeta o IaTelemetriaService (IaModule importa o IaTelemetriaModule).
  constructor(@Optional() private readonly telemetria?: IaTelemetriaService) {}

  /** No boot, denuncia no log qualquer finalidade sensível que esteja saindo da rede (config
   * legada anterior à trava, ou fallback global por variável de ambiente). Achado A1. */
  onModuleInit(): void {
    for (const v of this.avisosPrivacidade()) {
      this.logger.warn(
        `PRIVACIDADE/LGPD: a finalidade "${v.finalidade}" lê dado de cliente e está usando o ` +
          `provedor "${v.provider}"${
            v.viaEnv ? ' (fallback global por variável de ambiente)' : ''
          } — o texto está SAINDO da rede. Reconfigure para um endpoint local em Config → IA.`,
      );
    }
  }

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

  /** Uma configuração está de pé? Normalmente é ter chave — mas no provedor `local` a chave
   * é OPCIONAL: Ollama e LM Studio não pedem nenhuma, e exigir uma inventada só para o
   * registro sobreviver seria teatro. Lá o que identifica o destino é a URL. */
  private configurada(c: ConfigFinalidade | undefined): boolean {
    if (!c) return false;
    return c.provider === 'local' ? !!c.baseUrl : !!c.apiKey;
  }

  /** Configuração efetiva de uma finalidade (própria, senão o fallback global). */
  private resolver(
    finalidade: FinalidadeIa,
  ): { config: ConfigFinalidade; viaEnv: boolean } | null {
    const propria = this.lerArquivo()[finalidade];
    if (this.configurada(propria)) {
      return { config: propria as ConfigFinalidade, viaEnv: false };
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

  /** Finalidades sensíveis (transcrição de cliente) que estão, na prática, saindo da rede —
   * seja por config explícita externa (legada, anterior à trava do `salvar`) ou pelo fallback
   * global Anthropic. Vazio = política de privacidade cumprida. Alimenta o aviso de boot e o
   * módulo Prontidão do Sistema. Ver A1 da auditoria de 2026-08-12. */
  avisosPrivacidade(): {
    finalidade: FinalidadeIa;
    provider: ProvedorIa;
    viaEnv: boolean;
  }[] {
    const avisos: {
      finalidade: FinalidadeIa;
      provider: ProvedorIa;
      viaEnv: boolean;
    }[] = [];
    for (const finalidade of FINALIDADES_SO_LOCAL) {
      const r = this.resolver(finalidade);
      if (r && r.config.provider !== 'local') {
        avisos.push({
          finalidade,
          provider: r.config.provider,
          viaEnv: r.viaEnv,
        });
      }
    }
    return avisos;
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
      baseUrl: resolvido?.config.baseUrl ?? '',
      viaEnv: resolvido?.viaEnv ?? false,
      modeloEconomico: resolvido?.config.modeloEconomico ?? '',
    };
  }

  statusTodas(): StatusFinalidade[] {
    return FINALIDADES_IA.map((f) => this.status(f.id));
  }

  /** Normaliza a URL base do provedor `local` e recusa o que não dá para chamar.
   *
   * Aceita só http/https e tira a barra final (senão a requisição sairia com `//chat/...`).
   * A URL é digitada pelo ADM na tela de Sistema — é ele quem decide para onde o painel
   * fala, e essa é justamente a função do recurso; o que não pode é aceitar um texto
   * qualquer e só descobrir na primeira chamada de IA, horas depois. */
  private normalizarBaseUrl(bruta: string): string {
    const texto = (bruta ?? '').trim().replace(/\/+$/, '');
    if (!texto) {
      throw new BadRequestException(
        'Informe a URL do serviço local (ex.: http://192.168.1.50:11434/v1).',
      );
    }
    let url: URL;
    try {
      url = new URL(texto);
    } catch {
      throw new BadRequestException(`URL inválida: "${texto}".`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException(
        'A URL do serviço local deve ser http ou https.',
      );
    }
    return texto;
  }

  /** Salva a configuração de uma finalidade — ou a REMOVE quando vem vazia (chave em branco
   * nos provedores com chave; URL em branco no `local`). */
  salvar(finalidade: FinalidadeIa, dados: Partial<ConfigFinalidade>): void {
    const config = this.lerArquivo();
    const apiKey = (dados.apiKey ?? '').trim();
    // Eixo 7: modelo econômico opcional por finalidade. Guardado só quando informado.
    const modeloEconomico = (dados.modeloEconomico ?? '').trim();
    const provider: ProvedorIa = PROVEDORES_IA.includes(
      dados.provider as ProvedorIa,
    )
      ? (dados.provider as ProvedorIa)
      : 'anthropic';

    // Trava de privacidade (A1): finalidade que lê dado de cliente só aceita provedor local.
    // Vale só quando se ESTÁ configurando algo (provider externo com chave); limpar a
    // finalidade (chave/URL em branco) continua permitido e cai nos ramos abaixo.
    if (exigeProvedorLocal(finalidade) && provider !== 'local' && apiKey) {
      throw new BadRequestException(
        `A finalidade "${finalidade}" lê transcrição de reunião de cliente e, por privacidade ` +
          `(LGPD), só pode usar o provedor local — o texto não pode sair da rede. Configure um ` +
          `endpoint local (Ollama/LM Studio) em Config → IA, ou deixe a finalidade em branco.`,
      );
    }

    if (provider === 'local') {
      const baseUrl = (dados.baseUrl ?? '').trim();
      if (!baseUrl) {
        delete config[finalidade];
        this.gravarArquivo(config);
        return;
      }
      const modelo = (dados.modelo ?? '').trim();
      if (!modelo) {
        // Sem padrão possível: o nome do modelo é o que estiver carregado NAQUELE servidor
        // (`qwen2.5:14b`, `llama3.1:8b`…). Chutar produziria um 404 do Ollama na primeira
        // chamada, longe daqui.
        throw new BadRequestException(
          'Informe o nome do modelo carregado no serviço local (ex.: qwen2.5:14b).',
        );
      }
      config[finalidade] = {
        provider,
        // Opcional de propósito: Ollama/LM Studio não pedem chave. Fica guardada quando há
        // um proxy autenticado na frente.
        apiKey,
        modelo,
        baseUrl: this.normalizarBaseUrl(baseUrl),
        ...(modeloEconomico ? { modeloEconomico } : {}),
      };
      this.gravarArquivo(config);
      return;
    }

    if (!apiKey) {
      delete config[finalidade];
    } else {
      const modelo =
        (dados.modelo ?? '').trim() ||
        (provider === 'anthropic' ? MODELO_ANTHROPIC_PADRAO : '');
      config[finalidade] = {
        provider,
        apiKey,
        modelo,
        ...(modeloEconomico ? { modeloEconomico } : {}),
      };
    }
    this.gravarArquivo(config);
  }

  /** Catálogo público de modelos do OpenRouter (não exige chave) — alimenta o combo de
   * seleção de modelo na tela Modo IA. Falha graciosamente (lista vazia) se a rede cair. */
  async listarModelosOpenRouter(): Promise<{ id: string; nome: string }[]> {
    try {
      const resp = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        signal: AbortSignal.timeout(TIMEOUT_CATALOGO_MS),
      });
      if (!resp.ok) return [];
      const dados = (await resp.json()) as {
        data?: { id: string; name?: string }[];
      };
      return (dados.data ?? [])
        .map((m) => ({ id: m.id, nome: m.name ?? m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  /** Executa uma completude de chat para a finalidade, no provedor configurado.
   *
   * A9/A10: mede o tempo, captura o `usage` do provedor e registra a chamada na telemetria
   * (finalidade, provedor, modelo, tokens, custo estimado, quem/quando, status). O registro é
   * best-effort — nunca derruba a chamada. O `meta` é opcional (quem disparou + rótulo de
   * contexto). Se um teto diário de gasto estiver configurado e já tiver sido atingido, uma
   * nova chamada a provedor EXTERNO é interrompida com erro claro. */
  async completar(
    finalidade: FinalidadeIa,
    opcoes: OpcoesCompletar,
    meta?: MetaExecucaoIa,
  ): Promise<string> {
    // Kill switch de runtime (eixo 4): pausada a automação, NENHUMA chamada de IA passa — nem
    // local, nem externa. É o freio de emergência que o ADM aciona em Sistema → Automação.
    const freio = killSwitch.estado();
    if (freio.pausado) {
      throw new ServiceUnavailableException(
        `IA pausada pelo administrador${
          freio.motivo ? ` — ${freio.motivo}` : ''
        }. Retome em Sistema → Automação.`,
      );
    }

    const resolvido = this.resolver(finalidade);
    if (!resolvido) {
      throw new Error(
        `IA não configurada para a finalidade "${finalidade}" (Config → IA).`,
      );
    }
    const primaria = resolvido.config;
    // Eixo 8: provedor de RESERVA para failover. NUNCA existe para finalidade sensível — ela não
    // pode sair da rede, então prefere-se falhar a vazar (ver resolverAlternativa).
    const alternativa = this.resolverAlternativa(finalidade, primaria);

    try {
      return await this.tentarCompletar(finalidade, primaria, opcoes, meta);
    } catch (e) {
      if (!alternativa) throw e;
      this.logger.warn(
        `IA: o provedor "${primaria.provider}" falhou para "${finalidade}" — tentando o ` +
          `provedor de reserva "${alternativa.provider}". Causa: ${
            e instanceof Error ? e.message : String(e)
          }`,
      );
      return this.tentarCompletar(finalidade, alternativa, opcoes, meta);
    }
  }

  /** Uma tentativa contra UM provedor: escolhe o modelo (roteamento por custo, eixo 7), respeita
   * o teto de gasto (A9), mede o tempo e registra a telemetria (A9/A10). É o bloco que o failover
   * (eixo 8) repete com o provedor de reserva quando o primeiro falha. */
  private async tentarCompletar(
    finalidade: FinalidadeIa,
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
    meta?: MetaExecucaoIa,
  ): Promise<string> {
    const modelo = this.escolherModelo(config, opcoes);

    // Teto de gasto (A9): só barra provedor EXTERNO (o local não tem custo por token) e só
    // quando o teto está configurado (>0). É a única parte da telemetria que PODE interromper.
    if (
      config.provider !== 'local' &&
      (await this.telemetria?.tetoAtingido())
    ) {
      throw new ServiceUnavailableException(
        'Teto diário de gasto de IA atingido — novas chamadas a provedor externo estão ' +
          'suspensas até amanhã (ou aumente MIGRACAO_IA_TETO_DIARIO_USD).',
      );
    }

    const inicio = Date.now();
    try {
      const { texto, uso } = await this.despachar(
        { ...config, modelo },
        opcoes,
      );
      await this.telemetria?.registrar({
        finalidade,
        provider: config.provider,
        modelo,
        solicitante: meta?.solicitante ?? null,
        contexto: meta?.contexto,
        tokensEntrada: uso.tokensEntrada,
        tokensSaida: uso.tokensSaida,
        duracaoMs: Date.now() - inicio,
        status: 'ok',
      });
      return texto;
    } catch (e) {
      await this.telemetria?.registrar({
        finalidade,
        provider: config.provider,
        modelo,
        solicitante: meta?.solicitante ?? null,
        contexto: meta?.contexto,
        tokensEntrada: null,
        tokensSaida: null,
        duracaoMs: Date.now() - inicio,
        status: 'erro',
        erro: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  /** Eixo 7 (roteamento por custo): para uma TAREFA SIMPLES usa o `modeloEconomico` da
   * finalidade, quando configurado — modelo barato para trabalho barato. Sem modelo econômico,
   * nada muda. */
  private escolherModelo(
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
  ): string {
    const padrao =
      config.modelo ||
      (config.provider === 'anthropic' ? MODELO_ANTHROPIC_PADRAO : '');
    if (config.modeloEconomico && this.ehTarefaSimples(opcoes)) {
      return config.modeloEconomico;
    }
    return padrao;
  }

  /** Marca explícita (`opcoes.tarefaSimples`) vence; na ausência, decide pelo TAMANHO da entrada. */
  private ehTarefaSimples(opcoes: OpcoesCompletar): boolean {
    if (typeof opcoes.tarefaSimples === 'boolean') return opcoes.tarefaSimples;
    const tamanho =
      (opcoes.system?.length ?? 0) +
      opcoes.messages.reduce((s, m) => s + m.content.length, 0);
    return tamanho < LIMIAR_TAREFA_SIMPLES_CHARS;
  }

  /** Eixo 8: reserva de failover. A regra de PRIVACIDADE manda — finalidade sensível NUNCA cai
   * para um provedor externo (o texto não pode sair da rede), então não tem reserva. Para as
   * demais, o fallback global Anthropic serve de reserva, desde que a primária não seja ele. */
  private resolverAlternativa(
    finalidade: FinalidadeIa,
    primaria: ConfigFinalidade,
  ): ConfigFinalidade | null {
    if (exigeProvedorLocal(finalidade)) return null;
    const fb = this.fallbackAnthropic();
    if (!fb) return null;
    if (primaria.provider === 'anthropic' && primaria.apiKey === fb.apiKey) {
      return null;
    }
    return { provider: 'anthropic', apiKey: fb.apiKey, modelo: fb.modelo };
  }

  /** Despacha para o provedor certo e devolve o texto + os tokens consumidos. */
  private despachar(
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
  ): Promise<{ texto: string; uso: UsoIa }> {
    if (config.provider === 'openrouter') {
      return this.completarCompativel(
        config,
        OPENROUTER_BASE_URL,
        opcoes,
        TIMEOUT_REMOTO_MS,
      );
    }
    if (config.provider === 'local') {
      return this.completarCompativel(
        config,
        config.baseUrl ?? '',
        opcoes,
        // Modelo local não tem catálogo remoto para consultar, e um servidor engasgado
        // simplesmente não responde. Sem teto, o pipeline de transcrição ficaria pendurado.
        TIMEOUT_LOCAL_MS,
      );
    }
    return this.completarAnthropic(config, opcoes);
  }

  private async completarAnthropic(
    config: ConfigFinalidade,
    opcoes: OpcoesCompletar,
  ): Promise<{ texto: string; uso: UsoIa }> {
    // timeout: sem ele o SDK espera indefinidamente (A14). maxRetries=2 é o default do SDK.
    const client = new Anthropic({
      apiKey: config.apiKey,
      timeout: TIMEOUT_REMOTO_MS,
    });
    const resp = await client.messages.create({
      model: config.modelo || MODELO_ANTHROPIC_PADRAO,
      max_tokens: opcoes.maxTokens,
      // Eixo 6: temperatura baixa e fixa — tarefa factual, criatividade é defeito aqui.
      temperature: opcoes.temperatura ?? TEMPERATURA_FACTUAL,
      system: opcoes.system,
      messages: opcoes.messages,
    });
    const texto = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    // A9: o `usage` do Anthropic era descartado — agora vira tokens de entrada/saída.
    return {
      texto,
      uso: {
        tokensEntrada: resp.usage?.input_tokens ?? null,
        tokensSaida: resp.usage?.output_tokens ?? null,
      },
    };
  }

  /** Chat completions no dialeto da OpenAI — atende OpenRouter e qualquer serviço `local`
   * (Ollama, LM Studio, vLLM). A única diferença entre eles é a URL base e o fato de a chave
   * ser opcional no local; o corpo da requisição é idêntico, então o código é um só. O
   * `system` vira a primeira mensagem com role `system`. */
  private async completarCompativel(
    config: ConfigFinalidade,
    baseUrl: string,
    opcoes: OpcoesCompletar,
    timeoutMs?: number,
  ): Promise<{ texto: string; uso: UsoIa }> {
    const onde = config.provider === 'local' ? 'O serviço local' : 'OpenRouter';
    if (!config.modelo) {
      throw new Error(
        config.provider === 'local'
          ? 'Modelo do serviço local não informado (ex.: qwen2.5:14b).'
          : 'Modelo do OpenRouter não informado (ex.: anthropic/claude-sonnet-4).',
      );
    }
    if (!baseUrl) {
      throw new Error('URL do serviço local não configurada (Config → IA).');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Sem chave, sem cabeçalho: mandar `Bearer ` vazio faz alguns servidores recusarem com
    // 401 em vez de simplesmente ignorar a autenticação que não pediram.
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    // M9: propaga o correlation-id da requisição, quando há uma (chamada por robô/boot não tem).
    const requestId = requestIdAtual();
    if (requestId) headers[CABECALHO_REQUEST_ID] = requestId;

    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.modelo,
          max_tokens: opcoes.maxTokens,
          // Eixo 6: temperatura baixa e fixa (mesmo motivo do Anthropic).
          temperature: opcoes.temperatura ?? TEMPERATURA_FACTUAL,
          messages: [
            { role: 'system', content: opcoes.system },
            ...opcoes.messages,
          ],
        }),
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      });
    } catch (e) {
      // Servidor local desligado/inalcançável é o caso comum, e o erro cru do fetch
      // ("fetch failed") não diz nada a quem vai consertar.
      throw new Error(
        `${onde} não respondeu (${baseUrl}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '');
      throw new Error(
        `${onde} respondeu ${resp.status}: ${detalhe.slice(0, 300)}`,
      );
    }
    const dados = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    // A9: o `usage` no dialeto da OpenAI (prompt_tokens/completion_tokens) era descartado.
    // Nem todo servidor local devolve — daí o `?? null`.
    return {
      texto: dados.choices?.[0]?.message?.content ?? '',
      uso: {
        tokensEntrada: dados.usage?.prompt_tokens ?? null,
        tokensSaida: dados.usage?.completion_tokens ?? null,
      },
    };
  }
}
