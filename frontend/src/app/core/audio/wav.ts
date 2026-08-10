/** Empacotamento do áudio capturado no formato que o transcritor espera: WAV PCM 16 bits,
 * mono, 16 kHz (`docservice/transcricao/vivo.py` recusa qualquer outra combinação — a
 * junção final dos trechos é uma cópia crua de frames e só é válida se todos forem
 * iguais). Funções puras de propósito: são a parte da captura que dá para testar sem
 * navegador. */

export const TAXA_ALVO = 16000;

/** Junta os blocos recebidos do worklet num vetor só. */
export function juntar(blocos: Float32Array[]): Float32Array {
  const total = blocos.reduce((soma, b) => soma + b.length, 0);
  const saida = new Float32Array(total);
  let pos = 0;
  for (const bloco of blocos) {
    saida.set(bloco, pos);
    pos += bloco.length;
  }
  return saida;
}

/** Reamostra por interpolação linear. Normalmente é um no-op: o AudioContext já é criado
 * pedindo 16 kHz e o próprio navegador reamostra a captura. Existe porque essa taxa é um
 * PEDIDO — se o navegador entregar um contexto em 44,1/48 kHz (acontece quando o
 * dispositivo trava a taxa), enviar o áudio como se fosse 16 kHz faria a reunião inteira
 * ser transcrita em câmera lenta. */
export function reamostrar(
  amostras: Float32Array,
  taxaOrigem: number,
  taxaDestino = TAXA_ALVO,
): Float32Array {
  if (taxaOrigem === taxaDestino || amostras.length === 0) return amostras;
  const razao = taxaOrigem / taxaDestino;
  const total = Math.floor(amostras.length / razao);
  const saida = new Float32Array(total);
  for (let i = 0; i < total; i += 1) {
    const posicao = i * razao;
    const inteiro = Math.floor(posicao);
    const fracao = posicao - inteiro;
    const atual = amostras[inteiro];
    const proximo = amostras[inteiro + 1] ?? atual;
    saida[i] = atual + (proximo - atual) * fracao;
  }
  return saida;
}

/** Energia média do bloco — é o que distingue "alguém falando" de "sala em silêncio" na
 * hora de escolher onde cortar o trecho. */
export function rms(amostras: Float32Array): number {
  if (amostras.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < amostras.length; i += 1) soma += amostras[i] * amostras[i];
  return Math.sqrt(soma / amostras.length);
}

function escreverTexto(view: DataView, offset: number, texto: string): void {
  for (let i = 0; i < texto.length; i += 1) {
    view.setUint8(offset + i, texto.charCodeAt(i));
  }
}

/** Monta um .wav completo (com cabeçalho) a partir das amostras em ponto flutuante. */
export function paraWav(amostras: Float32Array, taxa = TAXA_ALVO): Blob {
  const bytesDados = amostras.length * 2;
  const buffer = new ArrayBuffer(44 + bytesDados);
  const view = new DataView(buffer);

  escreverTexto(view, 0, 'RIFF');
  view.setUint32(4, 36 + bytesDados, true);
  escreverTexto(view, 8, 'WAVE');
  escreverTexto(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // tamanho do bloco fmt
  view.setUint16(20, 1, true); // 1 = PCM sem compressão
  view.setUint16(22, 1, true); // canais (mono)
  view.setUint32(24, taxa, true);
  view.setUint32(28, taxa * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // alinhamento do bloco
  view.setUint16(34, 16, true); // bits por amostra
  escreverTexto(view, 36, 'data');
  view.setUint32(40, bytesDados, true);

  let offset = 44;
  for (let i = 0; i < amostras.length; i += 1) {
    const valor = Math.max(-1, Math.min(1, amostras[i]));
    view.setInt16(offset, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
