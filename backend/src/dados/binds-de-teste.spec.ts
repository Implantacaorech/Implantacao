import { bindsDeTeste } from './config-consultas-bd.controller';

/** O "Testar" da tela Consultas BD manda binds ao driver. Bind sobrando derruba a execução
 * com ORA-01036, exatamente como bind faltando derruba com ORA-01008 — então a regra é uma
 * só: enviar os que o SQL cita, e só eles.
 *
 * Até 2026-09-01 mandava `data_ini`/`data_fim` fixos, sempre. Funcionou enquanto toda
 * consulta salva do SICLA filtrava por período; a primeira que não filtra (contatos
 * liberados no Portal, só `:cliente`) passou a falhar no Testar. */
describe('bindsDeTeste', () => {
  it('supre só o que o SQL cita', () => {
    const b = bindsDeTeste('SELECT 1 FROM T WHERE C = :cliente');
    expect(Object.keys(b)).toEqual(['cliente']);
  });

  it('não manda data quando a consulta não filtra por período', () => {
    const b = bindsDeTeste('SELECT 1 FROM T WHERE C = :cliente');
    expect(b).not.toHaveProperty('data_ini');
    expect(b).not.toHaveProperty('data_fim');
  });

  it('a janela de um ano continua valendo para as consultas de período', () => {
    const b = bindsDeTeste(
      'SELECT 1 FROM T WHERE D >= :data_ini AND D < :data_fim',
    );
    expect(b.data_ini).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.data_fim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(b.data_fim) > String(b.data_ini)).toBe(true);
  });

  // Nulo é "sem recorte" — todo filtro opcional do catálogo é `(:bind IS NULL OR …)`, e é
  // isso que se quer de um teste: ver a consulta inteira.
  it('bind que não é data vai NULL', () => {
    const b = bindsDeTeste('SELECT 1 FROM T WHERE C = :cliente AND X = :termo');
    expect(b).toEqual({ cliente: null, termo: null });
  });

  it('mistura período com outros binds sem inventar nem esquecer', () => {
    const b = bindsDeTeste(
      'SELECT 1 FROM T WHERE D >= :data_ini AND C = :cliente',
    );
    expect(Object.keys(b).sort()).toEqual(['cliente', 'data_ini']);
    expect(b.cliente).toBeNull();
  });

  it('bind citado só em comentário não é enviado', () => {
    const b = bindsDeTeste(
      '-- filtra por :data_ini\nSELECT 1 FROM T WHERE C = :cliente',
    );
    expect(Object.keys(b)).toEqual(['cliente']);
  });

  it('SQL sem bind nenhum não manda nada', () => {
    expect(bindsDeTeste('SELECT 1 FROM DUAL')).toEqual({});
  });
});
