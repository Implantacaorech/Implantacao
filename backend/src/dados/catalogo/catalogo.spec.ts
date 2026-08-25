import { MENUS } from '../../common/constants/menus';
import {
  CATALOGO,
  consultaPorNome,
  nomesDisponiveis,
  TAMANHO_PAGINA_MAX,
} from './catalogo';
import { CONEXOES, ChaveConexao } from './catalogo.types';

/** O catálogo é o CONTRATO PÚBLICO da API de Dados: nome de consulta é endereço estável
 * para outro sistema, agente de IA e planilha de BI. Um nome duplicado, um menu que não
 * existe ou um parâmetro que o SQL não referencia não quebram nada no boot — quebram na
 * mão do consumidor, em produção, com mensagem confusa. Estes testes são o que impede
 * isso de passar despercebido no PR. */
describe('Catálogo da API de Dados', () => {
  const chavesMenu = new Set(MENUS.map((m) => m.chave));

  it('não tem nome repetido', () => {
    const nomes = CATALOGO.map((c) => c.nome);
    expect(nomes.length).toBe(new Set(nomes).size);
  });

  it('todo nome segue o padrão <origem>.<assunto>.<ação>', () => {
    const fora = CATALOGO.map((c) => c.nome).filter(
      (n) => !/^[a-z_]+(\.[a-z0-9-]+){2}$/.test(n),
    );
    expect(fora).toEqual([]);
  });

  it('aponta para uma conexão que existe', () => {
    const conhecidas = Object.keys(CONEXOES) as ChaveConexao[];
    const fora = CATALOGO.filter((c) => !conhecidas.includes(c.conexao)).map(
      (c) => c.nome,
    );
    expect(fora).toEqual([]);
  });

  it('nomesDisponiveis lista TODAS as consultas, para o cadastro de token', () => {
    // A autorização de um token é por CONSULTA: esta lista é o universo de opções da tela.
    // Se ela deixasse de acompanhar o catálogo, uma consulta nova nasceria inautorizável.
    const nomes = nomesDisponiveis();
    expect(nomes).toHaveLength(CATALOGO.length);
    expect(nomes).toEqual([...nomes].sort());
    expect(nomes).toContain('sicla.rns.listar');
  });

  it('todo menu declarado existe no painel de Permissões', () => {
    const inexistentes: string[] = [];
    for (const c of CATALOGO) {
      for (const menu of c.menus ?? []) {
        if (!chavesMenu.has(menu)) inexistentes.push(`${c.nome} → ${menu}`);
      }
    }
    // Menu inexistente faz `nivelEfetivo` devolver 'nada' para TODO mundo — a consulta
    // ficaria inacessível a qualquer pessoa, e o 403 não diria por quê.
    expect(inexistentes).toEqual([]);
  });

  it('todo parâmetro OBRIGATÓRIO é referenciado pelo SQL', () => {
    const problemas: string[] = [];
    for (const c of CATALOGO) {
      // `tela` não aparece no catálogo de CÓDIGO (é montada em runtime a partir de
      // consultas_bd), mas o narrow precisa cobri-la — daí o `in`.
      const base =
        c.origem.tipo === 'fixo'
          ? c.origem.sql
          : 'sqlPadrao' in c.origem
            ? c.origem.sqlPadrao
            : '';
      // A consulta cujo texto vive só em Consultas BD (sqlPadrao vazio) não tem como ser
      // conferida aqui — quem confere é o Administrador, na tela.
      if (!base.trim()) continue;
      const sql = c.envelopar ? c.envelopar(base) : base;
      for (const p of c.parametros) {
        if (!p.obrigatorio) continue;
        if (!new RegExp(`:${p.nome}(?![A-Za-z0-9_])`).test(sql)) {
          problemas.push(`${c.nome} exige :${p.nome}, que o SQL não usa`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  it('todo bind do SQL está declarado como parâmetro', () => {
    const problemas: string[] = [];
    for (const c of CATALOGO) {
      // `tela` não aparece no catálogo de CÓDIGO (é montada em runtime a partir de
      // consultas_bd), mas o narrow precisa cobri-la — daí o `in`.
      const base =
        c.origem.tipo === 'fixo'
          ? c.origem.sql
          : 'sqlPadrao' in c.origem
            ? c.origem.sqlPadrao
            : '';
      if (!base.trim()) continue;
      const sql = c.envelopar ? c.envelopar(base) : base;
      const declarados = new Set(c.parametros.map((p) => p.nome));
      // Ignora `::` (cast) e `:` seguido de dígito — nenhum dos dois é bind nomeado.
      for (const m of sql.matchAll(/(?<![:\w]):([a-z_][a-z0-9_]*)/g)) {
        if (!declarados.has(m[1])) {
          problemas.push(`${c.nome} usa :${m[1]}, não declarado no catálogo`);
        }
      }
    }
    expect([...new Set(problemas)]).toEqual([]);
  });

  it('todo limite de linhas é positivo e o cache não é negativo', () => {
    const fora = CATALOGO.filter(
      (c) => c.limiteLinhas <= 0 || c.cacheSegundos < 0,
    ).map((c) => c.nome);
    expect(fora).toEqual([]);
  });

  it('nenhuma consulta traz mais que o teto absoluto de uma página sem paginar', () => {
    // Não é proibido o limite passar do teto de página — só precisa ser consciente: acima
    // dele o consumidor É OBRIGADO a paginar, e isso tem que estar na descrição do
    // contrato (docs/api.md). O teste trava a lista de quem está nessa situação.
    const acima = CATALOGO.filter((c) => c.limiteLinhas > TAMANHO_PAGINA_MAX)
      .map((c) => c.nome)
      .sort();
    expect(acima).toEqual([
      'portal.visitas.listar',
      'sicla.agenda.horas-aplicadas',
      'sicla.bi.extrato-horas',
      'sicla.disponibilidade.ocupacao',
    ]);
  });

  it('tem título e descrição — é o que o consumidor externo lê', () => {
    const pobres = CATALOGO.filter(
      (c) => c.titulo.trim().length < 5 || c.descricao.trim().length < 30,
    ).map((c) => c.nome);
    expect(pobres).toEqual([]);
  });

  it('consultaPorNome encontra e apara espaço', () => {
    expect(consultaPorNome('  sicla.rns.listar  ')?.conexao).toBe('sicla');
    expect(consultaPorNome('nao.existe.aqui')).toBeUndefined();
  });
});
