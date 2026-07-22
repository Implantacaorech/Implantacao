// Utilitários de data "só data" (sem hora/timezone) usados pela distribuição automática —
// tudo em UTC para evitar bugs de DST na aritmética de dias/meses.

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 86_400_000);
}

/** Soma meses "grudando" no último dia do mês destino se o dia original não existir nele —
 * mesmo comportamento de `calendar.monthrange` usado no Flask. */
export function addMonthsClamped(d: Date, meses: number): Date {
  const anoBase = d.getUTCFullYear();
  const mesBase = d.getUTCMonth();
  const dia = d.getUTCDate();
  const total = mesBase + meses;
  const ano = anoBase + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, diasNoMes)));
}

/** 0=segunda..6=domingo (convenção Python `date.weekday()`; JS Date.getUTCDay() é 0=domingo). */
export function weekdaySegunda0(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function diaUtil(d: Date): boolean {
  return weekdaySegunda0(d) < 5;
}

/** Dia de hoje no fuso de QUEM USA o Painel (horário de Brasília), no formato AAAA-MM-DD.
 *
 * Usa os getters locais de propósito. `toISOString()` devolve a data em UTC, e o Brasil está
 * em UTC-3: das 21h à meia-noite, "hoje" em UTC já é o dia seguinte. Com isso, tudo que parte
 * de hoje — data inicial da distribuição do cronograma e as janelas de disponibilidade dos
 * consultores — pulava um dia para quem trabalhasse à noite.
 *
 * A aritmética de dias segue em UTC (ver o topo do arquivo): o que muda aqui é só QUAL dia é
 * hoje, não como os dias são somados. */
export function hojeIso(): string {
  const agora = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}
