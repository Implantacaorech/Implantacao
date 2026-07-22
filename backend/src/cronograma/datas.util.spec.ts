import {
  addDays,
  addMonthsClamped,
  diaUtil,
  hojeIso,
  parseIso,
  toIso,
  weekdaySegunda0,
} from './datas.util';

describe('hojeIso — dia de hoje no fuso de quem usa o Painel', () => {
  const tzOriginal = process.env.TZ;

  afterEach(() => {
    jest.useRealTimers();
    process.env.TZ = tzOriginal;
  });

  it('devolve o dia LOCAL, não o dia em UTC, na virada noturna', () => {
    // 22/07 às 02:04 UTC é ainda 21/07 às 23:04 em Brasília. Com `toISOString()` o sistema
    // dizia "hoje = 22/07" para quem estava trabalhando no dia 21 — todo dia, das 21h à
    // meia-noite. O fuso é fixado aqui porque o CI roda em UTC, onde o defeito não aparece.
    process.env.TZ = 'America/Sao_Paulo';
    jest.useFakeTimers().setSystemTime(new Date('2026-07-22T02:04:00Z'));
    expect(hojeIso()).toBe('2026-07-21');
  });

  it('coincide com o dia em UTC quando não há virada envolvida', () => {
    process.env.TZ = 'America/Sao_Paulo';
    jest.useFakeTimers().setSystemTime(new Date('2026-07-22T15:00:00Z'));
    expect(hojeIso()).toBe('2026-07-22');
  });
});

describe('datas.util', () => {
  it('parseIso/toIso fazem ida e volta sem deslocamento de fuso', () => {
    expect(toIso(parseIso('2026-03-15'))).toBe('2026-03-15');
  });

  it('addDays soma dias corretamente, inclusive virando mês', () => {
    expect(toIso(addDays(parseIso('2026-01-31'), 1))).toBe('2026-02-01');
  });

  it('addMonthsClamped gruda no último dia do mês destino quando necessário', () => {
    // 31/jan + 1 mês -> fevereiro não tem dia 31 (2026 não é bissexto) -> 28/fev
    expect(toIso(addMonthsClamped(parseIso('2026-01-31'), 1))).toBe(
      '2026-02-28',
    );
  });

  it('addMonthsClamped soma 18 meses (janela usada na distribuição automática)', () => {
    expect(toIso(addMonthsClamped(parseIso('2026-07-13'), 18))).toBe(
      '2028-01-13',
    );
  });

  it('weekdaySegunda0 usa a convenção 0=segunda..6=domingo', () => {
    expect(weekdaySegunda0(parseIso('2026-07-13'))).toBe(0); // segunda-feira
    expect(weekdaySegunda0(parseIso('2026-07-18'))).toBe(5); // sábado
    expect(weekdaySegunda0(parseIso('2026-07-19'))).toBe(6); // domingo
  });

  it('diaUtil só é true de segunda a sexta', () => {
    expect(diaUtil(parseIso('2026-07-17'))).toBe(true); // sexta
    expect(diaUtil(parseIso('2026-07-18'))).toBe(false); // sábado
    expect(diaUtil(parseIso('2026-07-19'))).toBe(false); // domingo
  });
});
