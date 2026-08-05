/** Rótulos de locutor na transcrição (`P1`, `P2`…) e o mapa que os traduz em NOMES.
 *
 * A decisão central: o texto transcrito guarda SEMPRE o rótulo; o nome real vive num mapa
 * à parte (`protocolos.mapa_locutores`, JSON `{"P1":"Ivian"}`). Renomear é trocar o mapa,
 * nunca reescrever a transcrição. Consequências que motivaram a escolha:
 *
 * - renomear é **reversível** e instantâneo, e corrigir um nome digitado errado não deixa
 *   rastro no texto;
 * - substituir texto seria destrutivo e ambíguo — "P1" pode aparecer dentro de uma fala
 *   (um código de produto, por exemplo), e uma troca cega corromperia o registro;
 * - a IA recebe o texto JÁ com os nomes aplicados, o que melhora o resumo (ela distingue
 *   quem é consultor e quem é cliente), sem que o original perca a marcação estável.
 */

/** Marca de locutor no início da fala: `[12:34] P2: ...`. Só casa no começo da linha e
 * logo após o timestamp — é o que impede confundir com um "P2" dito no meio da frase. */
const MARCA = /^(\[[0-9:]+\]\s*)P(\d+):/;

export type MapaLocutores = Record<string, string>;

export function lerMapa(json: string | null | undefined): MapaLocutores {
  if (!json) return {};
  try {
    const dados: unknown = JSON.parse(json);
    if (typeof dados !== 'object' || dados === null || Array.isArray(dados))
      return {};
    const mapa: MapaLocutores = {};
    for (const [k, v] of Object.entries(dados as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) mapa[k.toUpperCase()] = v.trim();
    }
    return mapa;
  } catch {
    // Mapa corrompido não pode derrubar a ficha — cai para "sem nomes".
    return {};
  }
}

/** Rótulos que aparecem na transcrição, na ordem em que falam pela primeira vez. É o que a
 * tela de renomear usa para montar os campos: só pergunta por quem realmente existe. */
export function locutoresDe(transcricao: string): string[] {
  const vistos: string[] = [];
  for (const linha of (transcricao || '').split('\n')) {
    const m = MARCA.exec(linha);
    if (m) {
      const rotulo = `P${m[2]}`;
      if (!vistos.includes(rotulo)) vistos.push(rotulo);
    }
  }
  return vistos;
}

/** Troca os rótulos pelos nomes do mapa. Quem não tem nome definido continua como `P3`. */
export function aplicarNomes(transcricao: string, mapa: MapaLocutores): string {
  if (!transcricao || Object.keys(mapa).length === 0) return transcricao || '';
  return transcricao
    .split('\n')
    .map((linha) =>
      linha.replace(MARCA, (inteiro, tempo: string, num: string) => {
        const nome = mapa[`P${num}`];
        return nome ? `${tempo}${nome}:` : inteiro;
      }),
    )
    .join('\n');
}
