import { textoAparado, textoDe } from '../common/utils/texto.util';

export interface DiffLinha {
  ref: string;
  campo: string;
  de: string;
  para: string;
}

/** Compara duas listas de linhas POSICIONALMENTE (linha 1 vs linha 1, linha 2 vs linha 2,
 * ...) e devolve um `Modificacao` por diferença — mesma lógica (e mesma limitação
 * conhecida) de webapp/db.py:salvar_linhas: como a comparação é por ÍNDICE, não por id,
 * inserir/remover uma linha no meio do plano faz TODAS as linhas seguintes aparecerem
 * como "todo campo mudou" (ruído de histórico), em vez de detectar um deslocamento.
 * Preservado de propósito para fidelidade ao original — não é o comportamento ideal, mas
 * é o que o Flask sempre fez. */
export function diffLinhas<T extends Record<string, unknown>>(
  antigas: T[],
  novas: T[],
  campos: string[],
  camposResumo: [string, string],
): DiffLinha[] {
  const resumo = (r: T | undefined): string => {
    if (!r) return '(linha vazia)';
    const a = textoAparado(r[camposResumo[0]]);
    const b = textoAparado(r[camposResumo[1]]);
    const texto = [a, b].filter(Boolean).join(' · ');
    return texto || '(linha vazia)';
  };

  const diffs: DiffLinha[] = [];
  const max = Math.max(antigas.length, novas.length);
  for (let i = 0; i < max; i++) {
    const antiga = antigas[i];
    const nova = novas[i];
    if (antiga && !nova) {
      diffs.push({
        ref: `linha ${i + 1}`,
        campo: 'linha',
        de: resumo(antiga),
        para: '(removida)',
      });
    } else if (!antiga && nova) {
      diffs.push({
        ref: `linha ${i + 1}`,
        campo: 'linha',
        de: '(nova)',
        para: resumo(nova),
      });
    } else if (antiga && nova) {
      for (const campo of campos) {
        const de = textoDe(antiga[campo]);
        const para = textoDe(nova[campo]);
        if (de !== para) {
          diffs.push({ ref: `linha ${i + 1} · ${campo}`, campo, de, para });
        }
      }
    }
  }
  return diffs;
}
