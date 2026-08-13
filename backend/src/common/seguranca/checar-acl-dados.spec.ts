import { avaliarSaidaIcacls } from './checar-acl-dados';

describe('avaliarSaidaIcacls (M5)', () => {
  it('pasta trancada (só SYSTEM/Administradores/dono) não é exposição', () => {
    const saida = [
      'C:\\painel\\backend\\dados NT AUTHORITY\\SYSTEM:(OI)(CI)(F)',
      '                          BUILTIN\\Administrators:(OI)(CI)(F)',
      '                          DESKTOP\\servico.painel:(OI)(CI)(F)',
      '',
      'Foram processados com \u00eaxito 1 arquivos; 0 arquivos falharam',
    ].join('\r\n');
    const r = avaliarSaidaIcacls(saida);
    expect(r.exposto).toBe(false);
    expect(r.principais).toEqual([]);
  });

  it('BUILTIN\\Users com acesso é exposição', () => {
    const saida =
      'C:\\painel\\backend\\dados BUILTIN\\Users:(OI)(CI)(RX)\r\n' +
      '                          NT AUTHORITY\\SYSTEM:(OI)(CI)(F)';
    const r = avaliarSaidaIcacls(saida);
    expect(r.exposto).toBe(true);
    expect(r.principais).toContain('\\Users');
  });

  it('Everyone com acesso é exposição', () => {
    const saida = 'C:\\painel\\backend\\dados Everyone:(OI)(CI)(F)';
    expect(avaliarSaidaIcacls(saida).exposto).toBe(true);
  });

  it('reconhece os nomes em português (Windows pt-BR)', () => {
    const saida = 'C:\\painel\\backend\\dados BUILTIN\\Usuários:(OI)(CI)(RX)';
    const r = avaliarSaidaIcacls(saida);
    expect(r.exposto).toBe(true);
    expect(r.principais).toContain('\\Usuários');
  });
});
