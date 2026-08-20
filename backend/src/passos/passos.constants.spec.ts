import {
  ETAPAS,
  PERFIS_GERA_CRONOGRAMA,
  PERFIS_GERA_LEVANTAMENTO,
} from '../common/constants/perfis';
import {
  PASSOS,
  PASSOS_COM_CONFERENCIA,
  PASSOS_COM_MARCACAO,
  PASSOS_POR_NUMERO,
  PERFIS_TELA_DO_PASSO,
} from './passos.constants';

/** Prova que o mapa dos 21 passos corresponde ao processo descrito pelo usuário. É a
 * especificação executável do fluxo — se alguém mexer no processo sem pensar, é aqui que
 * quebra. Revisão de 2026-07-30: entraram o passo 5 (Comercial) e o 12 (Projeto assinado). */
describe('mapa dos 21 passos do processo', () => {
  it('tem exatamente 21 passos, numerados de 1 a 21 sem buraco', () => {
    expect(PASSOS.length).toBe(21);
    expect(PASSOS.map((p) => p.numero)).toEqual(
      Array.from({ length: 21 }, (_, i) => i + 1),
    );
  });

  it('cada passo pertence a uma das 6 macro-etapas existentes', () => {
    // Os 21 passos NÃO substituem as macro-etapas: elas continuam sendo o que o painel,
    // as métricas e os filtros usam.
    for (const p of PASSOS) {
      expect(ETAPAS).toContain(p.etapa);
    }
  });

  it('atribui a cada passo o responsável que o processo define', () => {
    const esperado: Record<number, string> = {
      // Entrada do processo (revisão 2026-07-27): o Comercial consulta o cliente no SICLA e
      // cadastra a ficha. O passo 5 é o segundo momento do Comercial no fluxo — ele decide
      // que a negociação pode ser fechada e descreve o que ficou acertado.
      1: 'Comercial',
      2: 'Administrativo',
      3: 'Levantador',
      4: 'Levantador',
      5: 'Comercial',
      6: 'Administrativo',
      7: 'Administrativo',
      8: 'Coordenador',
      9: 'Administrativo',
      10: 'GCI',
      11: 'Administrativo',
      12: 'Administrativo',
      13: 'Consultor',
      14: 'Consultor',
      15: 'Consultor',
      16: 'Consultor',
      17: 'Consultor',
      18: 'Consultor',
      19: 'Administrativo',
      20: 'Consultor',
      21: 'Consultor',
    };
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.responsavel}`).toBe(
        `${p.numero}:${esperado[p.numero]}`,
      );
    }
  });

  it('abre as trilhas paralelas a partir do passo 8', () => {
    // Do passo 8 (equipe definida) saem TRÊS frentes que não se esperam: a RNS (9), o
    // Projeto (10) e o Cronograma (13). Nenhuma delas depende das outras — foi o que o
    // usuário pediu em 2026-07-30 ao marcar 9 e 10 como "não trancam as próximas etapas" e
    // o bloco do 13 em diante como independente do 11 e do 12.
    expect(PASSOS_POR_NUMERO.get(9)?.depende).toEqual([8]);
    expect(PASSOS_POR_NUMERO.get(10)?.depende).toEqual([8]);
    expect(PASSOS_POR_NUMERO.get(13)?.depende).toEqual([8]);
    expect(PASSOS_POR_NUMERO.get(13)?.depende).not.toContain(11);
    expect(PASSOS_POR_NUMERO.get(13)?.depende).not.toContain(12);
    // Ninguém depende do 9: incluir as RNS não tranca nada.
    expect(PASSOS.filter((p) => p.depende.includes(9))).toEqual([]);
  });

  it('faz a conferência do Projeto esperar o Projeto existir', () => {
    // O 10 não tranca a trilha do cronograma, mas a conferência (11) precisa do arquivo
    // gerado — é o que o Administrativo visualiza, baixa e manda ao cliente.
    expect(PASSOS_POR_NUMERO.get(11)?.depende).toEqual([10]);
    expect(PASSOS_POR_NUMERO.get(12)?.depende).toEqual([11]);
  });

  it('encadeia o bloco final (13 em diante) um passo de cada vez', () => {
    for (let n = 14; n <= 21; n += 1) {
      expect(PASSOS_POR_NUMERO.get(n)?.depende).toEqual([n - 1]);
    }
  });

  it('torna definitivo tudo a partir do passo 14', () => {
    for (const p of PASSOS) {
      expect(`${p.numero}:${p.irreversivel}`).toBe(
        `${p.numero}:${p.numero >= 14}`,
      );
    }
  });

  it('exige conferência só nos passos 11 e 19', () => {
    expect([...PASSOS_COM_CONFERENCIA].sort((a, b) => a - b)).toEqual([11, 19]);
  });

  it('cobra a marcação de assinatura nos passos 7 e 12', () => {
    // Contrato assinado (7) e Projeto assinado (12) só fecham com a data da assinatura.
    expect(
      Object.keys(PASSOS_COM_MARCACAO)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([7, 12]);
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

  it('só os passos de tela têm permissão de ABRIR, e ela vem da tela de destino', () => {
    // ABRIR não é CONCLUIR: quem preenche o Levantamento (passo 3) é quem tem acesso àquela
    // tela, não só o Levantador designado que responde pela conclusão. As listas têm de ser
    // as mesmas que o controller/rota já aplicam, senão o botão promete o que a tela recusa.
    expect(
      Object.keys(PERFIS_TELA_DO_PASSO)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([3, 10, 13, 14]);
    expect(PERFIS_TELA_DO_PASSO[3]).toEqual(PERFIS_GERA_LEVANTAMENTO);
    expect(PERFIS_TELA_DO_PASSO[10]).toEqual(PERFIS_GERA_LEVANTAMENTO);
    expect(PERFIS_TELA_DO_PASSO[13]).toEqual(PERFIS_GERA_CRONOGRAMA);
    expect(PERFIS_TELA_DO_PASSO[14]).toEqual(PERFIS_GERA_CRONOGRAMA);
    // O 11 (Conferência do Projeto) saiu em 2026-08-20: ele não leva mais a tela nenhuma —
    // o Administrativo confere pelo "Visualizar"/"Baixar" do próprio cartão do passo e envia
    // ao cliente por "Redigir e-mail".
    expect(PERFIS_TELA_DO_PASSO[11]).toBeUndefined();
  });

  it('deixa abrir o Levantamento quem não é o responsável por concluí-lo', () => {
    // O caso que o usuário reportou: o GCI (e o Coordenador, e o Administrativo) via o botão
    // "Abrir" do passo 3 e não conseguia entrar no preenchimento.
    expect(PASSOS_POR_NUMERO.get(3)?.responsavel).toBe('Levantador');
    expect(PERFIS_TELA_DO_PASSO[3]).toEqual(
      expect.arrayContaining([
        'Levantador',
        'GCI',
        'Coordenador',
        'Administrativo',
      ]),
    );
  });
});
