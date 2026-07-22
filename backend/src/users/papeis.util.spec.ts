import { temPapel } from '../common/constants/perfis';
import { normalizarPapeis, papeisDoUsuario } from './papeis.util';

/** O usuário acumula cargos (revisão de 2026-07-22): a mesma pessoa costuma ser GCI e
 * Levantador. Permissão passou a perguntar "TEM o papel?", não "o perfil É?". */
describe('papéis do usuário', () => {
  it('lê a lista completa de papéis', () => {
    expect(
      papeisDoUsuario({ perfil: 'GCI', perfis: 'GCI, Levantador' }),
    ).toEqual(['GCI', 'Levantador']);
  });

  it('inclui o papel principal mesmo que ele falte na lista marcada', () => {
    // Se alguém desmarcar o próprio cargo principal na tela, não pode perder o acesso.
    expect(papeisDoUsuario({ perfil: 'ADM', perfis: 'Consultor' })).toEqual([
      'ADM',
      'Consultor',
    ]);
  });

  it('cadastro antigo, sem lista, continua valendo pelo perfil', () => {
    expect(papeisDoUsuario({ perfil: 'Coordenador', perfis: '' })).toEqual([
      'Coordenador',
    ]);
    expect(papeisDoUsuario({ perfil: 'Coordenador' })).toEqual(['Coordenador']);
  });

  it('descarta papel inexistente vindo da tela', () => {
    expect(
      papeisDoUsuario({ perfil: 'Consultor', perfis: 'Consultor, Diretor' }),
    ).toEqual(['Consultor']);
    expect(normalizarPapeis(['GCI', 'Chefe', 'Levantador'])).toEqual([
      'GCI',
      'Levantador',
    ]);
  });

  it('não repete papel marcado duas vezes', () => {
    expect(normalizarPapeis(['GCI', 'GCI'])).toEqual(['GCI']);
    expect(papeisDoUsuario({ perfil: 'GCI', perfis: 'GCI' })).toEqual(['GCI']);
  });
});

describe('temPapel', () => {
  const gciELevantador = {
    perfil: 'GCI' as const,
    perfis: ['GCI' as const, 'Levantador' as const],
  };

  it('reconhece QUALQUER um dos papéis do usuário', () => {
    expect(temPapel(gciELevantador, 'Levantador')).toBe(true);
    expect(temPapel(gciELevantador, 'GCI')).toBe(true);
    expect(temPapel(gciELevantador, 'ADM', 'Levantador')).toBe(true);
  });

  it('nega o papel que a pessoa não tem', () => {
    expect(temPapel(gciELevantador, 'Consultor')).toBe(false);
    expect(temPapel(gciELevantador, 'ADM')).toBe(false);
  });

  it('recua para o perfil único quando não há lista', () => {
    expect(temPapel({ perfil: 'Administrativo' }, 'Administrativo')).toBe(true);
    expect(temPapel({ perfil: 'Administrativo' }, 'GCI')).toBe(false);
  });

  it('usuário ausente não tem papel nenhum', () => {
    expect(temPapel(undefined, 'ADM')).toBe(false);
    expect(temPapel(null, 'ADM')).toBe(false);
  });
});
