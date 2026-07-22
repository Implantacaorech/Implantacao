import { ETAPAS } from '../common/constants/perfis';
import {
  PASSOS,
  PASSOS_COM_CONFERENCIA,
  PASSOS_POR_NUMERO,
} from './passos.constants';

/** Prova que o mapa dos 18 passos corresponde ao processo descrito pelo usuário em
 * 2026-07-22. É a especificação executável do fluxo — se alguém mexer no processo sem
 * pensar, é aqui que quebra. */
describe('mapa dos 18 passos do processo', () => {
  it('tem exatamente 18 passos, numerados de 1 a 18 sem buraco', () => {
    expect(PASSOS.length).toBe(18);
    expect(PASSOS.map((p) => p.numero)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
  });

  it('cada passo pertence a uma das 6 macro-etapas existentes', () => {
    // Os 18 passos NÃO substituem as macro-etapas: elas continuam sendo o que o painel,
    // as métricas e os filtros usam.
    for (const p of PASSOS) {
      expect(ETAPAS).toContain(p.etapa);
    }
  });

  it('atribui a cada passo o responsável que o processo define', () => {
    const esperado: Record<number, string> = {
      1: 'Automatico',
      2: 'Administrativo',
      3: 'Levantador',
      4: 'Administrativo',
      5: 'Administrativo',
      6: 'Coordenador',
      7: 'Administrativo',
      8: 'GCI',
      9: 'Administrativo',
      10: 'Consultor',
      11: 'Consultor',
      12: 'Consultor',
      13: 'Consultor',
      14: 'Consultor',
      15: 'Consultor',
      16: 'Administrativo',
      17: 'Consultor',
      18: 'Consultor',
    };
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.responsavel}`).toBe(
        `${p.numero}:${esperado[p.numero]}`,
      );
    }
  });

  it('abre duas trilhas paralelas a partir do passo 7', () => {
    // O Projeto (8) e o Cronograma (10) saem os DOIS do passo 7. O 10 não depende do 8 —
    // é o ponto que o usuário destacou: "não depende da etapa 8, pode ser feita em paralelo".
    expect(PASSOS_POR_NUMERO.get(8)?.depende).toEqual([7]);
    expect(PASSOS_POR_NUMERO.get(10)?.depende).toEqual([7]);
    expect(PASSOS_POR_NUMERO.get(10)?.depende).not.toContain(8);
  });

  it('torna definitivo tudo a partir do passo 11', () => {
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.irreversivel}`).toBe(
        `${p.numero}:${p.numero >= 11}`,
      );
    }
  });

  it('exige conferência só nos passos 9 e 16', () => {
    expect([...PASSOS_COM_CONFERENCIA].sort((a, b) => a - b)).toEqual([9, 16]);
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
