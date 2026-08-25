import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConsultaBdService } from './consulta-bd.service';
import { CATALOGO } from './catalogo/catalogo';
import { CatalogoService } from './catalogo/catalogo.service';
import { ConexoesService, ResultadoBruto } from './conexoes/conexoes.service';
import { DadosService, IdentidadeChamador } from './dados.service';

const QUEM: IdentidadeChamador = {
  tipo: 'usuario',
  id: '1',
  nome: 'Teste',
};

const linhas = (n: number): Record<string, unknown>[] =>
  Array.from({ length: n }, (_, i) => ({ PEDIDO: 1000 + i, ITEM: i }));

const ok = (qtd: number): ResultadoBruto => ({
  ok: true,
  mensagem: `${qtd} linha(s).`,
  colunas: ['PEDIDO', 'ITEM'],
  linhas: linhas(qtd),
});

interface Dublês {
  servico: DadosService;
  executar: jest.Mock<Promise<ResultadoBruto>, unknown[]>;
  configurada: jest.Mock<boolean, unknown[]>;
  porSlug: jest.Mock;
}

function montar(overrides: Partial<ResultadoBruto> = {}): Dublês {
  const executar = jest
    .fn<Promise<ResultadoBruto>, unknown[]>()
    .mockResolvedValue({ ...ok(3), ...overrides });
  const configurada = jest.fn<boolean, unknown[]>().mockReturnValue(true);
  // O stub referencia os binds do catálogo de propósito: o executor só manda o bind que o
  // SQL VIGENTE cita, então um stub sem eles esconderia o caminho normal.
  const porSlug = jest.fn().mockResolvedValue({
    sql: 'SELECT 1 FROM DUAL WHERE D >= :data_ini AND D < :data_fim AND X LIKE :termo',
  });

  const conexoes = {
    executar,
    configurada,
    motivoIndisponivel: () => 'Conexão não configurada.',
  } as unknown as ConexoesService;
  const consultas = { porSlug } as unknown as ConsultaBdService;
  // Catálogo efetivo = só o de código neste teste; as consultas de tela têm spec própria.
  const catalogo = {
    listar: () => Promise.resolve(CATALOGO),
    porNome: (nome: string) =>
      Promise.resolve(CATALOGO.find((c) => c.nome === nome)),
    nomes: () => Promise.resolve(CATALOGO.map((c) => c.nome).sort()),
  } as unknown as CatalogoService;

  return {
    servico: new DadosService(conexoes, consultas, catalogo),
    executar,
    configurada,
    porSlug,
  };
}

/** O executor é a fronteira: é aqui que "toda consulta passa por uma API" deixa de ser
 * intenção e vira comportamento — consulta desconhecida não roda, parâmetro inválido não
 * chega ao banco, e o SQL nunca vem de quem chama. */
describe('DadosService', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('lista o catálogo sem expor o SQL', async () => {
    const { servico } = montar();
    const lista = await servico.listar();
    expect(lista.length).toBeGreaterThan(10);
    for (const c of lista) {
      expect(Object.keys(c)).not.toContain('origem');
      // Mira o SHAPE de um comando (SELECT … FROM), não a palavra solta: uma descrição
      // pode legitimamente citar "select" em prosa, e travar a palavra faria o teste
      // reprovar texto humano em vez de vazamento de SQL.
      expect(JSON.stringify(c)).not.toMatch(/\bSELECT\b[\s\S]*\bFROM\b/i);
    }
  });

  it('recorta a listagem pelas consultas que o token autoriza', async () => {
    // Um consumidor externo só enxerga a documentação do que ele mesmo pode consumir.
    const { servico } = montar();
    const so = await servico.listar(['portal.visitas.listar']);
    expect(so.map((c) => c.nome)).toEqual(['portal.visitas.listar']);
  });

  it('404 em consulta que não existe no catálogo', async () => {
    const { servico } = montar();
    await expect(
      servico.executar('nao.existe.aqui', {}, {}, QUEM),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400 com a lista de erros quando o parâmetro é inválido', async () => {
    const { servico, executar } = montar();
    await expect(
      servico.executar(
        'sicla.rns.listar',
        { data_ini: 'ontem', data_fim: '2026-08-31' },
        {},
        QUEM,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    // O ponto do 400: o SQL nem chegou a ser enviado ao banco.
    expect(executar).not.toHaveBeenCalled();
  });

  it('503 quando a conexão não está configurada', async () => {
    const { servico, configurada } = montar();
    configurada.mockReturnValue(false);
    await expect(
      servico.executar(
        'sicla.rns.listar',
        { data_ini: '2026-08-01', data_fim: '2026-08-31' },
        {},
        QUEM,
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('502 quando o banco de ORIGEM falha — não 500', async () => {
    const { servico } = montar({
      ok: false,
      mensagem: 'ORA-00942: tabela ou view não existe',
      colunas: [],
      linhas: [],
    });
    await expect(
      servico.executar(
        'sicla.rns.listar',
        { data_ini: '2026-08-01', data_fim: '2026-08-31' },
        {},
        QUEM,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('executa e devolve o resultado paginado', async () => {
    const { servico, executar } = montar(ok(12));
    const r = await servico.executar(
      'sicla.rns.listar',
      { data_ini: '2026-08-01', data_fim: '2026-08-31' },
      { pagina: 2, tamanho: 5 },
      QUEM,
    );
    expect(r.consulta).toBe('sicla.rns.listar');
    expect(r.conexao).toBe('sicla');
    expect(r.linhas).toHaveLength(5);
    expect(r.paginacao).toMatchObject({
      pagina: 2,
      tamanho: 5,
      retornadas: 5,
      totalCarregado: 12,
      temMais: true,
    });
    // O limite que vai ao banco é o da CONSULTA, nunca o do consumidor.
    expect(executar).toHaveBeenCalledWith(
      'sicla',
      expect.any(String),
      { data_ini: '2026-08-01', data_fim: '2026-08-31' },
      5000,
    );
  });

  it('marca truncadoNoLimite quando o banco devolveu exatamente o teto', async () => {
    const { servico } = montar(ok(200));
    const r = await servico.executar(
      'sicla.rns.detalhar',
      { pedido: 5001 },
      {},
      QUEM,
    );
    expect(r.paginacao.truncadoNoLimite).toBe(true);
  });

  it('envelopa a consulta derivada em vez de duplicar o SQL base', async () => {
    const { servico, executar } = montar();
    await servico.executar('sicla.rns.detalhar', { pedido: 5001 }, {}, QUEM);
    const sqlEnviado = executar.mock.calls[0][1] as string;
    expect(sqlEnviado).toContain('WHERE PEDIDO = :pedido');
    expect(sqlEnviado).toContain('SELECT 1 FROM DUAL');
  });

  it('usa o SQL salvo em Consultas BD, não o embutido no código', async () => {
    const { servico, executar, porSlug } = montar();
    porSlug.mockResolvedValue({ sql: 'SELECT :data_ini AS EDITADO FROM DUAL' });
    await servico.executar(
      'sicla.rns.listar',
      { data_ini: '2026-08-01', data_fim: '2026-08-31' },
      {},
      QUEM,
    );
    expect(executar.mock.calls[0][1]).toContain('EDITADO');
    // `:data_fim` sumiu do SQL editado — o bind não pode ir junto, ou o driver recusa.
    expect(executar.mock.calls[0][2]).toEqual({ data_ini: '2026-08-01' });
  });

  it('sem a consulta salva, cai no texto SEMEADO pelo catálogo', async () => {
    // Antes de o catálogo ser dono do SQL, `previsao_inicio_oficial` era a única consulta
    // sem fallback — o texto vivia dentro do ConsultaBdService. Com a semeadura derivada do
    // catálogo, banco recém-criado (ou consulta apagada por engano) não derruba mais a
    // tela: roda o texto da semente. O 503 continua guardando o caso de um `sqlPadrao`
    // vazio, que hoje nenhuma entrada tem — é defesa, não caminho.
    const { servico, executar, porSlug } = montar();
    porSlug.mockResolvedValue(null);
    const r = await servico.executar(
      'sicla.dashboards.previsao-inicio-oficial',
      { data_ini: '2026-08-01', data_fim: '2026-08-31' },
      {},
      QUEM,
    );
    expect(r.consulta).toBe('sicla.dashboards.previsao-inicio-oficial');
    expect(executar.mock.calls[0][1]).toContain('POWERBI_IMP_RNIMPLANTACAO_2');
  });

  it('serve do cache dentro do TTL e vai ao banco uma vez só', async () => {
    const { servico, executar } = montar();
    const params = { data_ini: '2026-08-01', data_fim: '2026-08-31' };
    const primeira = await servico.executar(
      'sicla.rns.listar',
      params,
      {},
      QUEM,
    );
    const segunda = await servico.executar(
      'sicla.rns.listar',
      params,
      {},
      QUEM,
    );
    expect(executar).toHaveBeenCalledTimes(1);
    expect(primeira.cache).toBe(false);
    expect(segunda.cache).toBe(true);
    expect(segunda.linhas).toEqual(primeira.linhas);
  });

  it('não cacheia a consulta que declara cacheSegundos 0', async () => {
    const { servico, executar } = montar();
    await servico.executar('sicla.clientes.buscar', { termo: 'x' }, {}, QUEM);
    await servico.executar('sicla.clientes.buscar', { termo: 'x' }, {}, QUEM);
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('limparCache derruba o que estava guardado', async () => {
    const { servico, executar } = montar();
    const params = { data_ini: '2026-08-01', data_fim: '2026-08-31' };
    await servico.executar('sicla.rns.listar', params, {}, QUEM);
    expect(servico.limparCache()).toBe(1);
    await servico.executar('sicla.rns.listar', params, {}, QUEM);
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('conta execuções, acertos de cache e erros nas métricas', async () => {
    const { servico } = montar();
    const params = { data_ini: '2026-08-01', data_fim: '2026-08-31' };
    await servico.executar('sicla.rns.listar', params, {}, QUEM);
    await servico.executar('sicla.rns.listar', params, {}, QUEM);
    const m = servico
      .listarMetricas()
      .find((x) => x.consulta === 'sicla.rns.listar');
    expect(m).toMatchObject({ execucoes: 2, acertosCache: 1, erros: 0 });
  });

  // ── consultar(): a porta dos MÓDULOS do Painel ────────────────────────────────────
  describe('consultar — não lança, devolve o shape do executor antigo', () => {
    it('devolve {ok, mensagem, colunas, linhas} no caminho feliz', async () => {
      const { servico } = montar(ok(3));
      const r = await servico.consultar('sicla.rns.listar', {
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
      });
      expect(r).toMatchObject({ ok: true, mensagem: '3 linha(s).' });
      expect(r.colunas).toEqual(['PEDIDO', 'ITEM']);
      expect(r.linhas).toHaveLength(3);
    });

    it('NÃO trunca em 5000 linhas — o teto é o da consulta, não o da página', async () => {
      // `sicla.bi.extrato-horas` carrega até 10.000 linhas. Se `consultar` passasse pela
      // paginação de `executar`, o módulo receberia 5.000 e nunca saberia — número errado
      // no extrato, sem erro nenhum. É o motivo de `rodar` existir separado.
      const { servico } = montar(ok(7000));
      const r = await servico.consultar('sicla.bi.extrato-horas', {
        data_ini: '2026-01-01',
        data_fim: '2026-08-31',
      });
      expect(r.linhas).toHaveLength(7000);
    });

    it('erro do banco vira {ok:false, mensagem} — a tela degrada, não estoura', async () => {
      const { servico } = montar({
        ok: false,
        mensagem: 'ORA-12541: no listener',
        colunas: [],
        linhas: [],
      });
      const r = await servico.consultar('sicla.rns.listar', {
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
      });
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('ORA-12541');
      expect(r.linhas).toEqual([]);
    });

    it('parâmetro inválido vira mensagem legível, com todos os erros juntos', async () => {
      const { servico, executar } = montar();
      const r = await servico.consultar('sicla.rns.listar', {
        data_ini: 'ontem',
      });
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('AAAA-MM-DD');
      expect(r.mensagem).toContain('"data_fim" é obrigatório');
      expect(executar).not.toHaveBeenCalled();
    });

    it('conexão inativa vira a mensagem que diz onde resolver', async () => {
      const { servico, configurada } = montar();
      configurada.mockReturnValue(false);
      const r = await servico.consultar('sicla.rns.listar', {
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
      });
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('não configurada');
    });

    it('consulta fora do catálogo não estoura o módulo que a pediu', async () => {
      const { servico } = montar();
      const r = await servico.consultar('sicla.inventada.aqui');
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('não existe no catálogo');
    });
  });

  it('descrever devolve o contrato da consulta', async () => {
    const { servico } = montar();
    const c = await servico.descrever('sicla.bi.indicadores');
    expect(c.parametros.map((p) => p.nome)).toEqual(['comp_ini', 'comp_fim']);
    expect(c.conexao).toBe('sicla');
  });
});
