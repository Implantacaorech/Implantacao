import { CortadorTrechos } from './cortador';
import { juntar, paraWav, reamostrar, rms, TAXA_ALVO } from './wav';

/** Blocos do tamanho que o worklet entrega (4096 amostras). `amplitude` 0 = silêncio. */
function bloco(amplitude: number, tamanho = 4096): Float32Array {
  const b = new Float32Array(tamanho);
  for (let i = 0; i < tamanho; i += 1) {
    b[i] = amplitude * Math.sin((i / tamanho) * Math.PI * 2 * 40);
  }
  return b;
}

describe('wav', () => {
  it('monta um cabeçalho RIFF/WAVE PCM 16 bits mono na taxa pedida', async () => {
    const blob = paraWav(new Float32Array([0, 0.5, -0.5, 1]), TAXA_ALVO);
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const texto = (pos: number, tam: number) =>
      Array.from({ length: tam }, (_, i) =>
        String.fromCharCode(view.getUint8(pos + i)),
      ).join('');

    // O docservice recusa qualquer combinação diferente (vivo.py) — é o contrato entre as
    // duas pontas, por isso está travado em teste.
    expect(texto(0, 4)).toBe('RIFF');
    expect(texto(8, 4)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16); // bits por amostra
    expect(view.getUint32(40, true)).toBe(8); // 4 amostras x 2 bytes
    expect(buffer.byteLength).toBe(44 + 8);
  });

  it('satura em vez de estourar quando a amostra passa de 1', async () => {
    const buffer = await paraWav(new Float32Array([2, -2])).arrayBuffer();
    const view = new DataView(buffer);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });

  it('juntar preserva ordem e tamanho total', () => {
    const junto = juntar([new Float32Array([1, 2]), new Float32Array([3])]);
    expect(Array.from(junto)).toEqual([1, 2, 3]);
  });

  it('reamostrar reduz proporcionalmente e não mexe quando a taxa já é a alvo', () => {
    const entrada = new Float32Array(48000);
    expect(reamostrar(entrada, 48000, 16000).length).toBe(16000);
    expect(reamostrar(entrada, 16000, 16000)).toBe(entrada);
  });

  it('rms separa silêncio de fala', () => {
    expect(rms(bloco(0))).toBe(0);
    expect(rms(bloco(0.5))).toBeGreaterThan(0.1);
  });
});

describe('CortadorTrechos', () => {
  const taxa = TAXA_ALVO;

  it('não corta antes do mínimo, mesmo em silêncio', () => {
    const cortador = new CortadorTrechos({ taxa, minSeg: 15, maxSeg: 30 });
    // 10 s de silêncio: cortar aqui geraria trechos curtos demais (cada um custa uma
    // rodada do Whisper).
    for (let i = 0; i < Math.ceil((10 * taxa) / 4096); i += 1) {
      expect(cortador.adicionar(bloco(0))).toBeNull();
    }
    expect(cortador.segundosAcumulados).toBeGreaterThan(9);
  });

  it('corta na primeira pausa depois do mínimo', () => {
    const cortador = new CortadorTrechos({ taxa, minSeg: 1, maxSeg: 30 });
    let trecho: Float32Array | null = null;
    for (let i = 0; i < 10 && !trecho; i += 1) {
      // fala contínua não fecha o trecho...
      trecho = cortador.adicionar(bloco(0.5));
    }
    expect(trecho).toBeNull();
    // ...o silêncio (fim de frase) fecha.
    expect(cortador.adicionar(bloco(0))).not.toBeNull();
  });

  it('corta na marra no máximo, para quem fala sem pausa', () => {
    const cortador = new CortadorTrechos({ taxa, minSeg: 1, maxSeg: 2 });
    let trecho: Float32Array | null = null;
    let blocos = 0;
    while (!trecho && blocos < 100) {
      trecho = cortador.adicionar(bloco(0.5));
      blocos += 1;
    }
    expect(trecho).not.toBeNull();
    expect(trecho!.length).toBeGreaterThanOrEqual(2 * taxa);
  });

  it('fechar devolve o resto uma única vez (fim da gravação)', () => {
    const cortador = new CortadorTrechos({ taxa, minSeg: 60, maxSeg: 120 });
    cortador.adicionar(bloco(0.4));
    expect(cortador.fechar()?.length).toBe(4096);
    expect(cortador.fechar()).toBeNull();
  });
});
