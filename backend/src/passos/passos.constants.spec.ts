import { ETAPAS } from '../common/constants/perfis';
import {
  PASSOS,
  PASSOS_COM_CONFERENCIA,
  PASSOS_POR_NUMERO,
} from './passos.constants';

/** Prova que o mapa dos 19 passos corresponde ao processo descrito pelo usuário. É a
 * especificação executável do fluxo — se alguém mexer no processo sem pensar, é aqui que
 * quebra. O passo 3 "Realizar o Levantamento" foi (re)inserido em 2026-07-28. */
describe('mapa dos 19 passos do processo', () => {
  it('tem exatamente 19 passos, numerados de 1 a 19 sem buraco', () => {
    expect(PASSOS.length).toBe(19);
    expect(PASSOS.map((p) => p.numero)).toEqual(
      Array.from({ length: 19 }, (_, i) => i + 1),
    );
  });

  it('cada passo pertence a uma das 6 macro-etapas existentes', () => {
    // Os 19 passos NÃO substituem as macro-etapas: elas continuam sendo o que o painel,
    // as métricas e os filtros usam.
    for (const p of PASSOS) {
      expect(ETAPAS).toContain(p.etapa);
    }
  });

  it('atribui a cada passo o responsável que o processo define', () => {
    const esperado: Record<number, string> = {
      // Entrada do processo (revisão 2026-07-27): o Comercial consulta o cliente no SICLA e
      // cadastra a ficha. O passo 3 "Realizar o Levantamento" é do Levantador (2026-07-28),
      // antes de repassar ao Comercial (passo 4).
      1: 'Comercial',
      2: 'Administrativo',
      3: 'Levantador',
      4: 'Levantador',
      5: 'Administrativo',
      6: 'Administrativo',
      7: 'Coordenador',
      8: 'Administrativo',
      9: 'GCI',
      10: 'Administrativo',
      11: 'Consultor',
      12: 'Consultor',
      13: 'Consultor',
      14: 'Consultor',
      15: 'Consultor',
      16: 'Consultor',
      17: 'Administrativo',
      18: 'Consultor',
      19: 'Consultor',
    };
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.responsavel}`).toBe(
        `${p.numero}:${esperado[p.numero]}`,
      );
    }
  });

  it('abre duas trilhas paralelas a partir do passo 8', () => {
    // O Projeto (9) e o Cronograma (11) saem os DOIS do passo 8 (Incluir RNS). O 11 não
    // depende do 9 — "não depende da etapa do Projeto, pode ser feita em paralelo".
    expect(PASSOS_POR_NUMERO.get(9)?.depende).toEqual([8]);
    expect(PASSOS_POR_NUMERO.get(11)?.depende).toEqual([8]);
    expect(PASSOS_POR_NUMERO.get(11)?.depende).not.toContain(9);
  });

  it('torna definitivo tudo a partir do passo 12', () => {
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.irreversivel}`).toBe(
        `${p.numero}:${p.numero >= 12}`,
      );
    }
  });

  it('exige conferência só nos passos 10 e 17', () => {
    expect([...PASSOS_COM_CONFERENCIA].sort((a, b) => a - b)).toEqual([10, 17]);
  });

  it('encadeia cada passo apenas em passos anteriores', () => {
    // Dependência para a frente seria um processo impossível de concluir.
    for (const p of PASSOS) {
      for (const d of p.depende) expect(d).toBeLessThan(p.numero);
    }
  });

  it('só o passo 1 não depende de nada (é a entrada do processo)', () => {
    const semDependencia = PASSOS.filter((p) => p.depende.length === 0);
    expect(semDependencia.map((p) => p.numero)).toEqual([1]);
  });
});
