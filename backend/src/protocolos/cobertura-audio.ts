/** Detecção de gravação com áudio incompleto (microfone mudo/queda de captura no meio).
 *
 * Caso real (protocolo 76, 2026-08-14): um treinamento de 20min26s foi gravado com o
 * microfone vivo só no primeiro minuto — o resto da faixa é silêncio digital absoluto. A
 * transcrição saiu FIEL (15 s de fala) e o pipeline seguiu calado, entregando um protocolo
 * magro com cara de normal; o revisor só percebeu comparando com o que lembrava do
 * treinamento. O prejuízo não é o protocolo ruim, é a gravação perdida — quanto antes
 * alguém souber, maior a chance de regravar.
 *
 * A régua usa o que o pipeline já tem: o ÚLTIMO timestamp `[MM:SS]`/`[H:MM:SS]` da
 * transcrição contra a duração da mídia medida pelo transcritor. Fala terminando antes da
 * METADE de uma mídia com 2+ minutos não prova defeito — palestrante pode calar no meio —,
 * por isso vira AVISO nas pendências do revisor, nunca erro que trave o fluxo. */

/** Mídia mais curta que isto nunca gera aviso: memo de voz de 1 minuto é uso legítimo. */
const DURACAO_MINIMA_SEG = 120;

/** Fala cobrindo menos que esta fração da mídia dispara o aviso. */
const FRACAO_MINIMA = 0.5;

/** Último instante de fala reconhecida, em segundos, pelos timestamps `[M:SS]` ou
 * `[H:MM:SS]` que o transcritor põe no início de cada bloco. 0 = nenhum timestamp. */
export function ultimaFalaSeg(transcricao: string): number {
  let ultimo = 0;
  for (const m of transcricao.matchAll(/\[(\d+):(\d{2})(?::(\d{2}))?\]/g)) {
    const seg = m[3]
      ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
      : Number(m[1]) * 60 + Number(m[2]);
    if (seg > ultimo) ultimo = seg;
  }
  return ultimo;
}

function fmt(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Aviso para as pendências do revisor quando a fala reconhecida termina cedo demais em
 * relação à duração da mídia — ou `null` quando não há o que apontar (mídia curta, duração
 * desconhecida ou cobertura razoável). */
export function avisoAudioIncompleto(
  transcricao: string,
  duracaoSeg: number,
): string | null {
  if (!duracaoSeg || duracaoSeg < DURACAO_MINIMA_SEG) return null;
  const ultima = ultimaFalaSeg(transcricao);
  if (ultima >= duracaoSeg * FRACAO_MINIMA) return null;
  const pct = Math.max(1, Math.round((100 * ultima) / duracaoSeg));
  return (
    `⚠️ Áudio possivelmente incompleto: a última fala reconhecida está em ${fmt(ultima)}, ` +
    `mas a mídia tem ${fmt(duracaoSeg)} (~${pct}% coberto). Confira a gravação — microfone ` +
    `mudo ou queda de captura no meio — antes de aprovar; se o defeito se confirmar, o ` +
    `conteúdo não transcrito está perdido e o treinamento precisa ser regravado.`
  );
}
