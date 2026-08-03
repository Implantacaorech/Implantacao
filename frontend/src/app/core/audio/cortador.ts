import { juntar, rms } from './wav';

export interface OpcoesCorte {
  /** Taxa de amostragem dos blocos que chegam (a do AudioContext). */
  taxa: number;
  /** Só corta depois disso — trecho curto demais é caro (o Whisper roda por trecho). */
  minSeg?: number;
  /** Corta na marra aqui, mesmo no meio de uma frase — senão uma pessoa que fala sem
   * pausa nunca fecharia trecho e a transcrição pararia de aparecer na tela. */
  maxSeg?: number;
  /** Abaixo desta energia o bloco é considerado silêncio (pausa entre frases). */
  limiarSilencio?: number;
}

const PADRAO = { minSeg: 15, maxSeg: 30, limiarSilencio: 0.008 };

/** Decide ONDE cortar o áudio contínuo da reunião em trechos para transcrever.
 *
 * O critério não é o relógio: cortar de 20 em 20 s exatos parte palavra no meio umas 180
 * vezes numa reunião de 1 h, e como a transcrição final é a emenda dos trechos, cada corte
 * desses vira uma palavra perdida. Aqui o corte espera uma PAUSA na fala depois do mínimo
 * — na prática, o fim de uma frase. O máximo existe só como escape.
 *
 * Classe pura (não conhece navegador nem HTTP): é o miolo testável da captura. */
export class CortadorTrechos {
  private blocos: Float32Array[] = [];
  private acumuladas = 0;
  private readonly taxa: number;
  private readonly minAmostras: number;
  private readonly maxAmostras: number;
  private readonly limiar: number;

  constructor(opcoes: OpcoesCorte) {
    const min = opcoes.minSeg ?? PADRAO.minSeg;
    const max = opcoes.maxSeg ?? PADRAO.maxSeg;
    this.taxa = opcoes.taxa;
    this.minAmostras = Math.round(min * opcoes.taxa);
    this.maxAmostras = Math.round(max * opcoes.taxa);
    this.limiar = opcoes.limiarSilencio ?? PADRAO.limiarSilencio;
  }

  /** Segundos já acumulados no trecho em formação. */
  get segundosAcumulados(): number {
    return this.taxa ? this.acumuladas / this.taxa : 0;
  }

  get amostrasAcumuladas(): number {
    return this.acumuladas;
  }

  /** Acrescenta um bloco vindo do worklet. Devolve o trecho fechado quando é hora de
   * cortar, ou `null` para continuar acumulando. */
  adicionar(bloco: Float32Array): Float32Array | null {
    this.blocos.push(bloco);
    this.acumuladas += bloco.length;
    if (this.acumuladas >= this.maxAmostras) return this.fechar();
    if (this.acumuladas >= this.minAmostras && rms(bloco) < this.limiar) {
      return this.fechar();
    }
    return null;
  }

  /** Fecha o que estiver acumulado (fim da gravação). `null` se não houver nada. */
  fechar(): Float32Array | null {
    if (this.acumuladas === 0) return null;
    const trecho = juntar(this.blocos);
    this.blocos = [];
    this.acumuladas = 0;
    return trecho;
  }
}
