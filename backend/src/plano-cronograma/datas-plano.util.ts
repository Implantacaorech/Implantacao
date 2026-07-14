import { addDays, diaUtil, hojeIso, parseIso } from '../cronograma/datas.util';

/** Aceita "AAAA-MM-DD" (convenção do resto do Projeto) ou "DD/MM/AAAA" (formato que o
 * `data_inicio` do Flask também aceitava) — sem nenhum dos dois, cai em hoje, igual ao
 * fallback de webapp/tools/gerar_cronograma.py:_parse_date. */
export function parseDataPlano(s: string | null | undefined): Date {
  const v = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return parseIso(v);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return parseIso(hojeIso());
}

export function proximoUtil(d: Date): Date {
  let atual = d;
  while (!diaUtil(atual)) atual = addDays(atual, 1);
  return atual;
}

export function somarUteis(d: Date, n: number): Date {
  let atual = d;
  let restante = n;
  while (restante > 0) {
    atual = addDays(atual, 1);
    if (diaUtil(atual)) restante -= 1;
  }
  return atual;
}

export function formatarBr(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
