import { ConsultaBD } from '../../database/entities/consulta-bd.entity';
import { ConsultaBdService } from '../consulta-bd.service';
import { CATALOGO } from './catalogo';
import { CatalogoService } from './catalogo.service';

function linha(over: Partial<ConsultaBD> = {}): ConsultaBD {
  return {
    id: 1,
    slug: 'minha_consulta',
    nome: 'Minha consulta',
    sql: 'SELECT 1 FROM DUAL',
    ordem: 10,
    colunaData: '',
    colunaSituacao: '',
    mostrarGrafico: false,
    conexao: 'sicla',
    nomeApi: 'sicla.minha.consulta',
    publicada: true,
    parametros: JSON.stringify([
      { nome: 'termo', tipo: 'texto', obrigatorio: true, descricao: 'x' },
    ]),
    colunas: JSON.stringify(['A', 'B']),
    limiteLinhas: 500,
    cacheSegundos: 60,
    ...over,
  };
}

function montar(linhas: ConsultaBD[]) {
  const listar = jest.fn().mockResolvedValue(linhas);
  const salvas = { listar } as unknown as ConsultaBdService;
  return { servico: new CatalogoService(salvas), listar };
}

/** O catálogo EFETIVO junta o contrato revisado (código) com o que o Administrador publica
 * pela tela. É a peça que dá autonomia sem release — e por isso a que mais precisa de
 * limite: uma linha malformada não pode derrubar o catálogo nem sequestrar um nome. */
describe('CatalogoService', () => {
  it('junta as consultas de código com as publicadas pela tela', async () => {
    const { servico } = montar([linha()]);
    const itens = await servico.listar();
    expect(itens).toHaveLength(CATALOGO.length + 1);

    const nova = itens.find((c) => c.nome === 'sicla.minha.consulta');
    expect(nova).toMatchObject({
      conexao: 'sicla',
      limiteLinhas: 500,
      cacheSegundos: 60,
      donoAtual: 'tela (Consultas BD)',
    });
    expect(nova?.origem).toEqual({ tipo: 'tela', slug: 'minha_consulta' });
    expect(nova?.parametros.map((p) => p.nome)).toEqual(['termo']);
  });

  it('ignora consulta NÃO publicada — a tela de dashboards não vira API sozinha', async () => {
    const { servico } = montar([linha({ publicada: false })]);
    expect(await servico.listar()).toHaveLength(CATALOGO.length);
  });

  it('ignora linha sem nome público', async () => {
    const { servico } = montar([linha({ nomeApi: '  ' })]);
    expect(await servico.listar()).toHaveLength(CATALOGO.length);
  });

  it('ignora linha sem teto de linhas — publicar sem teto é pior que não publicar', async () => {
    const { servico } = montar([linha({ limiteLinhas: 0 })]);
    expect(await servico.listar()).toHaveLength(CATALOGO.length);
  });

  it('o CÓDIGO vence: consulta de tela não sequestra um nome do contrato revisado', async () => {
    const { servico } = montar([linha({ nomeApi: 'sicla.rns.listar' })]);
    const itens = await servico.listar();
    const rns = itens.filter((c) => c.nome === 'sicla.rns.listar');
    expect(rns).toHaveLength(1);
    // A que sobrou é a de código — origem `consulta_salva`, não `tela`.
    expect(rns[0].origem.tipo).toBe('consulta_salva');
  });

  it("traduz 'portal' (vocabulário da tela) para a conexão do catálogo", async () => {
    const { servico } = montar([linha({ conexao: 'portal' })]);
    const nova = (await servico.listar()).find(
      (c) => c.nome === 'sicla.minha.consulta',
    );
    expect(nova?.conexao).toBe('portal_rech');
  });

  it('parâmetros com JSON corrompido não derrubam o catálogo', async () => {
    const { servico } = montar([linha({ parametros: '{isso não é json' })]);
    const nova = (await servico.listar()).find(
      (c) => c.nome === 'sicla.minha.consulta',
    );
    expect(nova?.parametros).toEqual([]);
  });

  it('banco fora do ar não derruba o catálogo — as de código continuam valendo', async () => {
    const listar = jest.fn().mockRejectedValue(new Error('sem conexão'));
    const servico = new CatalogoService({
      listar,
    } as unknown as ConsultaBdService);
    expect(await servico.listar()).toHaveLength(CATALOGO.length);
  });

  it('cacheia a leitura e o invalidar derruba o cache', async () => {
    const { servico, listar } = montar([linha()]);
    await servico.listar();
    await servico.listar();
    expect(listar).toHaveBeenCalledTimes(1);

    servico.invalidar();
    await servico.listar();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('porNome e nomes enxergam a consulta de tela', async () => {
    const { servico } = montar([linha()]);
    expect((await servico.porNome('sicla.minha.consulta'))?.titulo).toBe(
      'Minha consulta',
    );
    expect(await servico.nomes()).toContain('sicla.minha.consulta');
    expect(await servico.porNome('nao.existe.aqui')).toBeUndefined();
  });

  it('consulta de tela exige o menu consulta_bd para usuário do Painel', async () => {
    // Quem publica é o ADM; um token de máquina alcança pela autorização explícita.
    const { servico } = montar([linha()]);
    const nova = await servico.porNome('sicla.minha.consulta');
    expect(nova?.menus).toEqual(['consulta_bd']);
  });
});
