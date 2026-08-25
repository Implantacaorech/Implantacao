import { ConsultaCatalogo } from './catalogo.types';
import { validarParametros } from './parametros.util';

const consulta = (
  parametros: ConsultaCatalogo['parametros'],
): ConsultaCatalogo => ({
  nome: 'teste.consulta.rodar',
  titulo: 'Teste',
  descricao: 'Consulta de teste do validador de parâmetros.',
  conexao: 'sicla',
  escopo: 'sicla:leitura',
  parametros,
  origem: { tipo: 'fixo', sql: 'SELECT 1' },
  limiteLinhas: 10,
  cacheSegundos: 0,
  donoAtual: 'teste',
  desde: 'v1',
});

const SQL_TUDO =
  'SELECT * FROM T WHERE D >= :data_ini AND C = :comp_ini AND N = :pedido ' +
  'AND X LIKE :termo AND H = :datahora AND P = :protocolo';

describe('validarParametros', () => {
  it('recusa data fora do formato AAAA-MM-DD', () => {
    const c = consulta([
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: true,
        descricao: 'início',
      },
    ]);
    const r = validarParametros(c, { data_ini: '01/08/2026' }, SQL_TUDO);
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain('AAAA-MM-DD');
  });

  it('recusa data que o calendário não tem (31 de fevereiro)', () => {
    // O `new Date` normaliza 2026-02-31 para 03-03 em silêncio — sem esta checagem o
    // consumidor receberia dados de MARÇO achando que pediu fevereiro.
    const c = consulta([
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: true,
        descricao: 'início',
      },
    ]);
    expect(validarParametros(c, { data_ini: '2026-02-31' }, SQL_TUDO).ok).toBe(
      false,
    );
    expect(validarParametros(c, { data_ini: '2026-02-28' }, SQL_TUDO).ok).toBe(
      true,
    );
  });

  it('converte competência AAAA-MM para o AAAA/MM que a view do SICLA guarda', () => {
    const c = consulta([
      {
        nome: 'comp_ini',
        tipo: 'competencia',
        obrigatorio: true,
        descricao: 'competência',
      },
    ]);
    const r = validarParametros(c, { comp_ini: '2026-08' }, SQL_TUDO);
    expect(r.ok).toBe(true);
    expect(r.binds.comp_ini).toBe('2026/08');
  });

  it('aplica o curinga do LIKE no tipo texto_busca (e não no texto simples)', () => {
    const c = consulta([
      {
        nome: 'termo',
        tipo: 'texto_busca',
        obrigatorio: true,
        descricao: 'termo',
      },
      {
        nome: 'protocolo',
        tipo: 'texto',
        obrigatorio: true,
        descricao: 'protocolo',
      },
    ]);
    const r = validarParametros(
      c,
      { termo: 'melbros', protocolo: 'A-1' },
      SQL_TUDO,
    );
    expect(r.binds.termo).toBe('%melbros%');
    expect(r.binds.protocolo).toBe('A-1');
  });

  it('recusa texto acima do limite declarado', () => {
    const c = consulta([
      {
        nome: 'termo',
        tipo: 'texto_busca',
        obrigatorio: true,
        descricao: 'termo',
        maxTamanho: 5,
      },
    ]);
    const r = validarParametros(c, { termo: 'abcdefgh' }, SQL_TUDO);
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain('5 caracteres');
  });

  it('exige o obrigatório e ignora o opcional ausente', () => {
    const c = consulta([
      {
        nome: 'pedido',
        tipo: 'inteiro',
        obrigatorio: true,
        descricao: 'pedido',
      },
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: false,
        descricao: 'início',
      },
    ]);
    expect(validarParametros(c, {}, SQL_TUDO).erros).toEqual([
      '"pedido" é obrigatório.',
    ]);
    const r = validarParametros(c, { pedido: 5001 }, SQL_TUDO);
    expect(r.ok).toBe(true);
    expect(r.binds).toEqual({ pedido: 5001 });
  });

  it('recusa parâmetro que não existe no contrato', () => {
    const c = consulta([]);
    const r = validarParametros(c, { qualquer: 1 }, SQL_TUDO);
    expect(r.ok).toBe(false);
    expect(r.erros[0]).toContain('não existe');
  });

  it('só manda o bind que o SQL VIGENTE referencia', () => {
    // O Administrador pode salvar em Consultas BD uma versão do SQL sem `:data_ini`.
    // Mandar o bind assim mesmo faz o driver recusar a execução inteira — daí o filtro.
    const c = consulta([
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: false,
        descricao: 'início',
      },
    ]);
    const r = validarParametros(
      c,
      { data_ini: '2026-08-01' },
      'SELECT * FROM T',
    );
    expect(r.ok).toBe(true);
    expect(r.binds).toEqual({});
  });

  it('não confunde :data_ini com :data_inicial', () => {
    const c = consulta([
      {
        nome: 'data_ini',
        tipo: 'data',
        obrigatorio: false,
        descricao: 'início',
      },
    ]);
    const r = validarParametros(
      c,
      { data_ini: '2026-08-01' },
      'SELECT * FROM T WHERE D = :data_inicial',
    );
    expect(r.binds).toEqual({});
  });

  it('recusa data/hora fora de AAAA-MM-DD HH:MM', () => {
    const c = consulta([
      {
        nome: 'datahora',
        tipo: 'datahora_minuto',
        obrigatorio: true,
        descricao: 'quando',
      },
    ]);
    expect(
      validarParametros(c, { datahora: '2026-08-25T10:30' }, SQL_TUDO).ok,
    ).toBe(false);
    expect(
      validarParametros(c, { datahora: '2026-08-25 10:30' }, SQL_TUDO).ok,
    ).toBe(true);
  });

  it('recusa inteiro que não é inteiro', () => {
    const c = consulta([
      {
        nome: 'pedido',
        tipo: 'inteiro',
        obrigatorio: true,
        descricao: 'pedido',
      },
    ]);
    expect(validarParametros(c, { pedido: '5001.5' }, SQL_TUDO).ok).toBe(false);
    expect(
      validarParametros(c, { pedido: '5001' }, SQL_TUDO).binds.pedido,
    ).toBe(5001);
  });
});
