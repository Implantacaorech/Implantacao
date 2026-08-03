import { CortadorTrechos } from './cortador';
import { paraWav, reamostrar, rms, TAXA_ALVO } from './wav';

/** De onde vem o áudio da reunião:
 * - `microfone`: reunião PRESENCIAL — o microfone da máquina/sala capta todo mundo;
 * - `reuniao`: reunião REMOTA (Teams) — o navegador captura o áudio da aba/tela
 *   compartilhada, ou seja, o que os participantes remotos falam;
 * - `ambos`: híbrido — gente na sala e gente no Teams ao mesmo tempo. As duas entradas
 *   são somadas num mixer só, e o transcritor recebe uma única faixa. */
export type FonteAudio = 'microfone' | 'reuniao' | 'ambos';

export interface OpcoesCaptura {
  fonte: FonteAudio;
  /** Chamado a cada trecho fechado (~15-30 s), na ordem. */
  aoTrecho: (wav: Blob, seq: number) => void | Promise<void>;
  /** Nível de áudio 0..1, para o medidor da tela. */
  aoNivel?: (nivel: number) => void;
  /** O usuário parou o compartilhamento da tela pelo próprio navegador. */
  aoPerderReuniao?: () => void;
}

export class ErroCaptura extends Error {}

const CAMINHO_WORKLET = 'gravacao-audio-worklet.js';

/** Motivo mais comum de a gravação não abrir: `getUserMedia`/`getDisplayMedia` só existem
 * em "contexto seguro" (https, ou http em localhost). O painel roda em
 * `http://I7M1700-01-EVE:5100`, que NÃO é — nessa máquina a captura precisa de HTTPS ou de
 * a origem ser liberada na política do navegador (ver docs/gravacao-reuniao.md). Sem essa
 * mensagem, o usuário só veria "undefined is not a function". */
export function capturaDisponivel(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== 'undefined'
  );
}

export function motivoIndisponivel(): string {
  if (typeof navigator === 'undefined') return 'Navegador não suportado.';
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return (
      'O navegador só libera o microfone em conexão segura (HTTPS) ou em localhost. ' +
      `Este painel está em ${window.location.origin}, que não é nenhum dos dois.`
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return (
      'Este navegador não oferece captura de áudio. Use o Edge ou o Chrome atualizados ' +
      '(o Internet Explorer e navegadores antigos não têm esse recurso).'
    );
  }
  return 'Este navegador não permite gravar áudio nesta página.';
}

/** Mesma página, mas por `localhost` — atalho REAL para destravar a gravação em quem está
 * na própria máquina do painel: `localhost` é contexto seguro por definição, sem HTTPS,
 * sem certificado e sem mexer em política de navegador. Devolve `null` quando já se está
 * em localhost (ou fora do navegador), porque aí não há atalho a oferecer. */
export function urlPorLocalhost(): string | null {
  if (typeof window === 'undefined') return null;
  const { hostname, port, pathname, search, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  return `${protocol}//localhost${port ? ':' + port : ''}${pathname}${search}`;
}

/** Estado bruto da checagem — vai para a tela quando a captura está bloqueada, para que o
 * diagnóstico não dependa de abrir o console do navegador. */
export function diagnosticoCaptura(): {
  origem: string;
  contextoSeguro: boolean;
  temMediaDevices: boolean;
  temAudioContext: boolean;
} {
  return {
    origem: typeof window === 'undefined' ? '—' : window.location.origin,
    contextoSeguro:
      typeof window !== 'undefined' && window.isSecureContext === true,
    temMediaDevices:
      typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    temAudioContext: typeof AudioContext !== 'undefined',
  };
}

/** Captura o áudio da reunião no navegador e entrega TRECHOS .wav prontos para transcrever.
 *
 * Grafo de áudio (um mixer só, para que o transcritor receba uma faixa única mesmo quando
 * há gente na sala e no Teams):
 *
 *   microfone ──┐
 *               ├─> mistura ─> worklet ─> ganho 0 ─> saída
 *   tela/Teams ─┘
 *
 * O "ganho 0" no fim existe por dois motivos: um nó de processamento só roda quando o
 * grafo chega até a saída, e sem zerar o volume o áudio capturado sairia pela caixa de som
 * — microfonia imediata numa reunião presencial. */
export class CapturaAudio {
  private ctx: AudioContext | null = null;
  private streams: MediaStream[] = [];
  private no: AudioWorkletNode | null = null;
  private cortador: CortadorTrechos | null = null;
  private opcoes: OpcoesCaptura | null = null;
  private seq = 0;
  private pausado = false;
  private segundosGravados = 0;

  get duracaoSeg(): number {
    return Math.floor(this.segundosGravados);
  }

  get emPausa(): boolean {
    return this.pausado;
  }

  get ativa(): boolean {
    return this.ctx !== null;
  }

  async iniciar(opcoes: OpcoesCaptura): Promise<void> {
    if (!capturaDisponivel()) throw new ErroCaptura(motivoIndisponivel());
    this.opcoes = opcoes;
    this.seq = 0;
    this.segundosGravados = 0;
    this.pausado = false;

    const fontes: MediaStream[] = [];
    try {
      if (opcoes.fonte === 'microfone' || opcoes.fonte === 'ambos') {
        fontes.push(await this.capturarMicrofone());
      }
      if (opcoes.fonte === 'reuniao' || opcoes.fonte === 'ambos') {
        fontes.push(await this.capturarReuniao());
      }
      this.streams = fontes;
      await this.montarGrafo(fontes);
    } catch (e) {
      this.pararStreams();
      throw e instanceof ErroCaptura ? e : new ErroCaptura(this.mensagemErro(e));
    }
  }

  private async capturarMicrofone(): Promise<MediaStream> {
    // Cancelamento de eco/ruído LIGADO: numa sala de reunião a máquina costuma estar com
    // caixa de som aberta (participantes remotos), e sem isso o próprio áudio deles volta
    // pelo microfone e aparece duplicado na transcrição.
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  private async capturarReuniao(): Promise<MediaStream> {
    const md = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
    };
    if (!md.getDisplayMedia) {
      throw new ErroCaptura(
        'Este navegador não captura o áudio de outra janela/aba. Use o Edge ou o Chrome.',
      );
    }
    // `video: true` é obrigatório: nenhum navegador aceita getDisplayMedia só com áudio.
    // Processamento desligado — aqui o áudio já vem "limpo" do Teams, e o AGC só faria a
    // fala oscilar de volume.
    const stream = await md.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new ErroCaptura(
        'A tela foi compartilhada SEM áudio. Repita e marque "Compartilhar áudio da guia" ' +
          '(reunião do Teams no navegador) ou "Compartilhar áudio do sistema" (aplicativo ' +
          'do Teams — nesse caso é preciso escolher a tela inteira).',
      );
    }
    // O vídeo não interessa (só o áudio é transcrito), mas parar a faixa encerraria o
    // compartilhamento inteiro em alguns navegadores — desligar entrega o mesmo alívio de
    // CPU sem esse risco.
    stream.getVideoTracks().forEach((t) => {
      t.enabled = false;
      t.addEventListener('ended', () => this.opcoes?.aoPerderReuniao?.());
    });
    stream
      .getAudioTracks()
      .forEach((t) =>
        t.addEventListener('ended', () => this.opcoes?.aoPerderReuniao?.()),
      );
    return stream;
  }

  private async montarGrafo(fontes: MediaStream[]): Promise<void> {
    // 16 kHz é um PEDIDO, não uma garantia — `reamostrar` cobre o caso de o navegador
    // devolver outra taxa (ver wav.ts).
    const ctx = new AudioContext({ sampleRate: TAXA_ALVO });
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(CAMINHO_WORKLET);

    const mistura = ctx.createGain();
    mistura.gain.value = 1;
    for (const stream of fontes) {
      if (stream.getAudioTracks().length === 0) continue;
      ctx.createMediaStreamSource(stream).connect(mistura);
    }

    const no = new AudioWorkletNode(ctx, 'gravacao-audio');
    no.port.onmessage = (ev: MessageEvent<Float32Array>) =>
      void this.receber(ev.data);
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    mistura.connect(no);
    no.connect(mudo).connect(ctx.destination);
    this.no = no;

    this.cortador = new CortadorTrechos({ taxa: ctx.sampleRate });
    if (ctx.state === 'suspended') await ctx.resume();
  }

  private async receber(bloco: Float32Array): Promise<void> {
    if (this.pausado || !this.cortador || !this.ctx) return;
    this.segundosGravados += bloco.length / this.ctx.sampleRate;
    this.opcoes?.aoNivel?.(Math.min(1, rms(bloco) * 8));
    const trecho = this.cortador.adicionar(bloco);
    if (trecho) await this.enviar(trecho);
  }

  private async enviar(trecho: Float32Array): Promise<void> {
    if (!this.ctx || !this.opcoes) return;
    const amostras = reamostrar(trecho, this.ctx.sampleRate);
    const seq = this.seq;
    this.seq += 1;
    await this.opcoes.aoTrecho(paraWav(amostras), seq);
  }

  pausar(): void {
    this.pausado = true;
  }

  retomar(): void {
    this.pausado = false;
  }

  /** Encerra a captura e envia o resto do áudio acumulado (o último trecho, quase sempre
   * mais curto que o mínimo). */
  async parar(): Promise<void> {
    this.pausado = true;
    const resto = this.cortador?.fechar() ?? null;
    if (resto && resto.length > 0) {
      try {
        await this.enviar(resto);
      } catch {
        // Perder o último trecho não pode impedir o encerramento — o áudio dele já está
        // fora do alcance, mas todo o resto da reunião continua salvo no servidor.
      }
    }
    if (this.no) {
      this.no.port.onmessage = null;
      this.no.disconnect();
      this.no = null;
    }
    this.pararStreams();
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        // Contexto já fechado — nada a fazer.
      }
      this.ctx = null;
    }
    this.cortador = null;
  }

  private pararStreams(): void {
    for (const stream of this.streams) {
      stream.getTracks().forEach((t) => t.stop());
    }
    this.streams = [];
  }

  private mensagemErro(e: unknown): string {
    const nome = (e as { name?: string })?.name ?? '';
    if (nome === 'NotAllowedError') {
      return (
        'Permissão negada. Libere o microfone (ou o compartilhamento de tela) para este ' +
        'endereço no cadeado da barra de endereços e tente de novo.'
      );
    }
    if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') {
      return 'Nenhum microfone encontrado nesta máquina.';
    }
    if (nome === 'NotReadableError') {
      return 'O microfone está em uso por outro programa (Teams, Meet, gravador...).';
    }
    return e instanceof Error ? e.message : String(e);
  }
}
