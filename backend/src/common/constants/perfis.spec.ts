import {
  PERFIS,
  PERFIS_AGENDAMENTO,
  PERFIS_CARTEIRA_VE_TODOS,
  PERFIS_DEFINE_GCI,
  PERFIS_DESIGNA,
  PERFIS_DESIGNA_CONSULTORES,
  PERFIS_GERA_CRONOGRAMA,
  PERFIS_GERA_LEVANTAMENTO,
  PERFIS_INTERNOS,
  PERFIS_SISTEMA,
  PERFIS_VEEM_TODOS_PROJETOS,
  Perfil,
  ehCliente,
  papeisConflitantes,
} from './perfis';

/** O papel `Cliente` é o primeiro papel EXTERNO do Painel (2026-08-31,
 * docs/acesso-cliente-bi.md). Todas as constantes `PERFIS_*` descrevem quem faz o quê
 * DENTRO da Rech, e nenhuma delas pode incluí-lo.
 *
 * Hoje isso é verdade por omissão — nenhuma lista o menciona. O teste existe porque
 * "verdade por omissão" é exatamente o que se perde sem querer: quem for acrescentar um
 * papel a uma dessas listas no futuro não tem por que lembrar que uma delas é externa. */
describe('perfis — o papel externo Cliente', () => {
  const LISTAS_INTERNAS: [string, Perfil[]][] = [
    ['PERFIS_SISTEMA', PERFIS_SISTEMA],
    ['PERFIS_DESIGNA', PERFIS_DESIGNA],
    ['PERFIS_VEEM_TODOS_PROJETOS', PERFIS_VEEM_TODOS_PROJETOS],
    ['PERFIS_CARTEIRA_VE_TODOS', PERFIS_CARTEIRA_VE_TODOS],
    ['PERFIS_GERA_CRONOGRAMA', PERFIS_GERA_CRONOGRAMA],
    ['PERFIS_GERA_LEVANTAMENTO', PERFIS_GERA_LEVANTAMENTO],
    ['PERFIS_AGENDAMENTO', PERFIS_AGENDAMENTO],
    ['PERFIS_DEFINE_GCI', PERFIS_DEFINE_GCI],
    ['PERFIS_DESIGNA_CONSULTORES', PERFIS_DESIGNA_CONSULTORES],
  ];

  it.each(LISTAS_INTERNAS)('%s não inclui o Cliente', (_nome, lista) => {
    expect(lista).not.toContain('Cliente');
  });

  it('PERFIS_INTERNOS é todo mundo, menos o Cliente', () => {
    expect(PERFIS_INTERNOS).not.toContain('Cliente');
    expect(PERFIS_INTERNOS).toHaveLength(PERFIS.length - 1);
    for (const p of PERFIS) {
      if (p !== 'Cliente') expect(PERFIS_INTERNOS).toContain(p);
    }
  });

  it('ehCliente vale pelo papel principal e pela lista de papéis', () => {
    expect(ehCliente({ perfil: 'Cliente' })).toBe(true);
    expect(ehCliente({ perfil: 'Consultor', perfis: ['Cliente'] })).toBe(true);
    expect(ehCliente({ perfil: 'Consultor', perfis: ['GCI'] })).toBe(false);
    expect(ehCliente(null)).toBe(false);
  });

  describe('papeisConflitantes — Cliente é exclusivo', () => {
    it('aceita o Cliente sozinho', () => {
      expect(papeisConflitantes(['Cliente'])).toBe(false);
    });

    it('aceita qualquer combinação só de papéis internos', () => {
      expect(papeisConflitantes(['GCI', 'Levantador'])).toBe(false);
      expect(papeisConflitantes([...PERFIS_INTERNOS])).toBe(false);
    });

    // O acúmulo de papéis existe para quem é GCI e Levantador ao mesmo tempo. Aplicado ao
    // Cliente, ele viraria a saída do recorte por cliente: quem também fosse Consultor
    // cairia no ramo "interno vê tudo" de toda verificação de escopo.
    it.each(PERFIS_INTERNOS)('recusa Cliente acumulado com %s', (interno) => {
      expect(papeisConflitantes(['Cliente', interno])).toBe(true);
      expect(papeisConflitantes([interno, 'Cliente'])).toBe(true);
    });
  });
});
