/* AudioWorklet da gravação de reuniões (menu Transcrição Áudio/Vídeo).
 *
 * Fica em public/ (e não dentro do bundle) porque `audioWorklet.addModule` carrega o
 * arquivo por URL, no thread de áudio — ele não passa pelo empacotador do Angular.
 *
 * Responsabilidade DELIBERADAMENTE mínima: copiar as amostras do mixer (microfone e/ou
 * áudio da reunião remota) e mandar para o thread principal em blocos de 4096 amostras
 * (~0,25 s a 16 kHz). Quem decide onde cortar o trecho, converte para 16 bits e monta o
 * .wav é `core/audio/captura-audio.ts` — assim essa lógica fica em TypeScript, testável
 * pelo Vitest, em vez de presa aqui dentro.
 */
const TAMANHO_BLOCO = 4096;

class GravacaoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(TAMANHO_BLOCO);
    this.pos = 0;
  }

  process(inputs) {
    const canal = inputs[0] && inputs[0][0];
    // Sem entrada conectada neste ciclo (troca de dispositivo, aba em segundo plano):
    // devolve true para o nó continuar vivo — retornar false o desligaria de vez.
    if (!canal) return true;
    for (let i = 0; i < canal.length; i += 1) {
      this.buffer[this.pos] = canal[i];
      this.pos += 1;
      if (this.pos === TAMANHO_BLOCO) {
        this.port.postMessage(this.buffer.slice());
        this.pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('gravacao-audio', GravacaoProcessor);
