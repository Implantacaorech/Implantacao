import { ehLeitura, extrairBinds } from './binds.util';

/** A extração de binds é o que permite criar consulta pela TELA sem digitar a lista de
 * parâmetros. Ela erra em dois sentidos e os dois custam caro: um bind fantasma vira
 * parâmetro que o SQL não usa (o driver recusa com bind sobrando), e um bind perdido vira
 * parâmetro não fornecido (o driver recusa também). */
describe('extrairBinds', () => {
  it('acha os binds na ordem, sem repetir', () => {
    const sql =
      'SELECT * FROM T WHERE D >= :data_ini AND D < :data_fim AND X = :data_ini';
    expect(extrairBinds(sql)).toEqual(['data_ini', 'data_fim']);
  });

  it('ignora `:algo` dentro de comentário de LINHA', () => {
    const sql = `-- ajuste :data_ini se precisar
SELECT 1 FROM DUAL WHERE X = :termo`;
    expect(extrairBinds(sql)).toEqual(['termo']);
  });

  it('ignora `:algo` dentro de comentário de BLOCO', () => {
    const sql = 'SELECT 1 FROM DUAL /* usa :antigo */ WHERE X = :novo';
    expect(extrairBinds(sql)).toEqual(['novo']);
  });

  it('ignora `:algo` dentro de literal entre aspas', () => {
    const sql = "SELECT 'texto com :falso' AS T FROM DUAL WHERE X = :real";
    expect(extrairBinds(sql)).toEqual(['real']);
  });

  it('não confunde `::` (cast colado de outro dialeto) com bind', () => {
    const sql = 'SELECT campo::text FROM T WHERE X = :real';
    expect(extrairBinds(sql)).toEqual(['real']);
  });

  it('não casa o miolo de um identificador', () => {
    expect(extrairBinds('SELECT A.B FROM T WHERE X = :ok')).toEqual(['ok']);
  });

  it('SQL sem bind devolve lista vazia', () => {
    expect(extrairBinds('SELECT 1 FROM DUAL')).toEqual([]);
    expect(extrairBinds('')).toEqual([]);
  });
});

describe('ehLeitura', () => {
  it('aceita SELECT e WITH, inclusive com comentário antes', () => {
    expect(ehLeitura('SELECT 1 FROM DUAL')).toBe(true);
    expect(ehLeitura('  with x as (select 1) select * from x')).toBe(true);
    expect(ehLeitura('-- comentário\n/* bloco */\nSELECT 1')).toBe(true);
    expect(ehLeitura('(SELECT 1 FROM DUAL)')).toBe(true);
  });

  it('recusa escrita — a consulta nem chega a ser salva', () => {
    const escrita = [
      'DELETE FROM T',
      'UPDATE T SET A = 1',
      'INSERT INTO T VALUES (1)',
      'DROP TABLE T',
      'BEGIN NULL; END;',
      '',
    ];
    // O `expect(valor, msg)` é do Vitest; o Jest aceita um argumento só — por isso a
    // mensagem acionável vai DENTRO do valor comparado (idioma já usado nas guardas).
    const passaram = escrita.filter((sql) => ehLeitura(sql));
    expect(passaram).toEqual([]);
  });

  it('não se deixa enganar por SELECT escondido depois de comentário', () => {
    // O executor aplica a mesma regra, mas barrar aqui evita que a consulta exista.
    expect(ehLeitura('/* SELECT */ DELETE FROM T')).toBe(false);
  });
});
