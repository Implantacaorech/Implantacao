import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import { hojeIso, parseIso, toIso } from '../cronograma/datas.util';
import {
  LIMITE_DETALHE_RNS,
  MAX_DIAS_JANELA_RNS,
  RnsService,
} from './rns.service';
import {
  LIMITE_CONSULTA_RNS,
  NOME_CONSULTA_RNS,
  SLUG_CONSULTA_RNS,
  SQL_CONSULTA_RNS_PADRAO,
} from './rns.constants';

/** Linha CRUA de `SICLA.LISTA_ITEMPED` — um item PAI (a RNS em si), como o Oracle devolve
 * com as datas já em `TO_CHAR(..., 'YYYY-MM-DD')`. */
function linha(over: Record<string, unknown> = {}) {
  return {
    CLIENTE: 5001,
    STATUS: 3,
    SUGESTAO: 'Conversão de histórico de vendas',
    TIPO: 6,
    SUBTIPO: null,
    CODIGO: 141234,
    PROJETO: null,
    PRIORIDADEA: null,
    PRIORIDADE: 12,
    PRIORIDADE_ANA: null,
    DISPONIVEL: 'N',
    TEMREQ: 'S',
    PEDIDO: 138643,
    ITEM: 1,
    TIPODES: '6-Conversão',
    STATUSDES: '3-Aprovada',
    STATUSPUBDES: 'Em produção',
    BACKLOGDES: 'Backlog Implantação',
    FASEDES: 'Produção',
    REQUISITODES: 'Com requisito',
    DATACRI: '2026-08-01',
    DATADESEJADA: '2026-09-15',
    DATAPREVISTA: '2026-09-30',
    DATAPREVFIMPROD: null,
    DATASTATUS8: null,
    DATASTATUS10: null,
    DIAS_TRIAGEM: 4,
    RESNOME: 'Liliana',
    SIGLA: 'CNV',
    FANTASIA: 'WLG Distribuidora',
    VISAOGERAL: '[BON] Converter o histórico de vendas dos últimos 5 anos',
    CONTATO: 'Fulano',
    VERSAOATU: '2.8.0',
    VERSAOLIB: '2.8.1',
    MINVERGERACAO: null,
    ANANOME: 'Giomar',
    VALCOORDENADORDES: 'Aprovado',
    VALTECNICODES: null,
    VALGRUPODES: null,
    FUNCAODES: 'Conversão de dados',
    REPRESENDES: null,
    PRODUCTOWNERDES: 'PO Conversão',
    CELULA: 'Célula A',
    MENU: '1.2-D',
    TURNOSPREV: 3,
    TIMEDES: 'Time Azul',
    PONTOS: 8,
    PROTOCOLO: '2026/1234',
    RNSFILHAS: '138644;138645',
    VALOR_COB: 1500.5,
    DETALHAMENTO: 'Detalhar o layout do arquivo de vendas.',
    MOTIVO: 'Cliente precisa do histórico para comissões.',
    PARECERENG: 'Viável; usar o conversor padrão.',
    ...over,
  };
}

describe('RnsService (tela Execução → RNS)', () => {
  let service: RnsService;
  const disponibilidade = { configurado: jest.fn(), executarSql: jest.fn() };
  const consultas = { porSlug: jest.fn(), salvar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RnsService,
        { provide: DisponibilidadeService, useValue: disponibilidade },
        { provide: ConsultaBdService, useValue: consultas },
      ],
    }).compile();
    service = module.get(RnsService);
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.executarSql.mockResolvedValue({
      ok: true,
      mensagem: '',
      colunas: [],
      linhas: [linha()],
    });
    // Sem versão editada no Consultas BD → vale o SQL default embutido.
    consultas.porSlug.mockResolvedValue(null);
    consultas.salvar.mockResolvedValue(null);
  });

  describe('consulta nomeada no Consultas BD', () => {
    it('semeia o SQL default no boot quando ainda não existe (sem sobrescrever edição)', async () => {
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        await service.onModuleInit();
        expect(consultas.salvar).toHaveBeenCalledWith(SLUG_CONSULTA_RNS, {
          nome: NOME_CONSULTA_RNS,
          sql: SQL_CONSULTA_RNS_PADRAO,
          ordem: expect.any(Number),
          mostrarGrafico: false,
        });

        // Já existe (editada ou não): não encosta.
        consultas.salvar.mockClear();
        consultas.porSlug.mockResolvedValue({ sql: 'SELECT 1 FROM dual' });
        await service.onModuleInit();
        expect(consultas.salvar).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = nodeEnv;
      }
    });

    it('usa a versão EDITADA do Consultas BD quando houver, com os binds que ela referencia', async () => {
      consultas.porSlug.mockResolvedValue({
        sql: 'SELECT 1 FROM dual WHERE :data_ini IS NOT NULL AND :data_fim IS NOT NULL',
      });
      await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(disponibilidade.executarSql).toHaveBeenCalledWith(
        expect.stringContaining('FROM dual'),
        { data_ini: '2026-07-01', data_fim: '2026-09-30' },
        undefined,
        LIMITE_CONSULTA_RNS,
      );
    });

    it('SQL editado SEM os binds roda sem eles (bind sobrando seria ORA-01036)', async () => {
      consultas.porSlug.mockResolvedValue({
        sql: 'SELECT 1 FROM SICLA.LISTA_ITEMPED',
      });
      await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(disponibilidade.executarSql).toHaveBeenCalledWith(
        expect.any(String),
        {},
        undefined,
        LIMITE_CONSULTA_RNS,
      );
    });
  });

  describe('janela (periodo)', () => {
    it('sem parâmetros cai em [1º dia do mês anterior, último dia do mês seguinte]', () => {
      const { ini, fim } = service.periodo({});
      const hoje = parseIso(hojeIso());
      expect(ini).toBe(
        toIso(
          new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1)),
        ),
      );
      expect(fim).toBe(
        toIso(
          new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 2, 0)),
        ),
      );
      expect(ini <= hojeIso() && hojeIso() <= fim).toBe(true);
    });

    it('datas informadas valem como vieram; invertida é ordenada', () => {
      expect(service.periodo({ ini: '2026-07-01', fim: '2026-09-30' })).toEqual(
        {
          ini: '2026-07-01',
          fim: '2026-09-30',
        },
      );
      expect(service.periodo({ ini: '2026-09-30', fim: '2026-07-01' })).toEqual(
        {
          ini: '2026-07-01',
          fim: '2026-09-30',
        },
      );
    });

    it('data inválida (2026-13-45) não passa — vira o default daquele lado', () => {
      const { ini } = service.periodo({ ini: '2026-13-45' });
      expect(ini.endsWith('-01')).toBe(true);
    });

    it(`janela maior que ${MAX_DIAS_JANELA_RNS} dias é aparada pelo fim`, () => {
      const { ini, fim } = service.periodo({
        ini: '2024-01-01',
        fim: '2026-12-31',
      });
      expect(ini).toBe('2024-01-01');
      expect(fim).toBe('2024-12-31'); // 366º dia a partir de 01/01/2024 (bissexto), inclusive
    });
  });

  describe('consultar', () => {
    it('consulta a LISTA_ITEMPED com os binds da janela e o teto de linhas', async () => {
      await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(disponibilidade.executarSql).toHaveBeenCalledWith(
        expect.stringContaining('SICLA.LISTA_ITEMPED'),
        { data_ini: '2026-07-01', data_fim: '2026-09-30' },
        undefined,
        LIMITE_CONSULTA_RNS,
      );
      const sql = disponibilidade.executarSql.mock.calls[0][0] as string;
      // Revisão de 2026-08-17: pais E filhas (sem filtro de PEDIDOPAI) e os campos longos.
      expect(sql).not.toContain('PEDIDOPAI');
      expect(sql).toContain('ITM.DETALHAMENTO');
      expect(sql).toContain('ITM.MOTIVO');
      expect(sql).toContain('ITM.PARECERENG');
      expect(sql).toContain('ORDER BY');
    });

    it('normaliza a linha crua: Pedido+Item numéricos, rótulos aparados, datas AAAA-MM-DD', async () => {
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.total).toBe(1);
      expect(r.itens[0]).toMatchObject({
        pedido: 138643,
        item: 1,
        codigo: 141234,
        cliente: 5001,
        sugestao: 'Conversão de histórico de vendas',
        tipoDes: '6-Conversão',
        statusDes: '3-Aprovada',
        dataCri: '2026-08-01',
        dataPrevista: '2026-09-30',
        fantasia: 'WLG Distribuidora',
        resNome: 'Liliana',
        rnsFilhas: '138644;138645',
        valorCob: 1500.5,
        detalhamento: 'Detalhar o layout do arquivo de vendas.',
        motivo: 'Cliente precisa do histórico para comissões.',
        parecerEng: 'Viável; usar o conversor padrão.',
      });
      // Vazio numérico vira null, nunca 0 — "pedido 0" seria dado inventado.
      expect(r.itens[0].turnosPrev).toBe(3);
      expect(r.itens[0].prioridade).toBe(12);
    });

    it('valor numérico ausente vira null e texto ausente vira vazio', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          linha({
            PRIORIDADE: null,
            VALOR_COB: null,
            SUBTIPO: null,
            DATAPREVISTA: null,
          }),
        ],
      });
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.itens[0].prioridade).toBeNull();
      expect(r.itens[0].valorCob).toBeNull();
      expect(r.itens[0].subtipo).toBe('');
      expect(r.itens[0].dataPrevista).toBe('');
    });

    it('marca `truncado` quando a consulta bate no teto de linhas', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: Array.from({ length: LIMITE_CONSULTA_RNS }, (_, i) =>
          linha({ PEDIDO: i + 1 }),
        ),
      });
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.truncado).toBe(true);
      expect(r.total).toBe(LIMITE_CONSULTA_RNS);
    });

    it('sem conexão configurada devolve o erro amigável e a janela pedida', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.erro).toContain('Ferramentas → Disponibilidade');
      expect(r).toMatchObject({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(r.itens).toEqual([]);
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });

    it('falha do SQL vira `erro` no resultado, não exceção', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.erro).toBe('ORA-00942');
      expect(r.itens).toEqual([]);
    });
  });

  describe('detalhar (resumo completo de UMA RNS — clique no calendário da Agenda)', () => {
    it('embrulha o SQL vigente filtrando por PEDIDO, sem janela de criação', async () => {
      const r = await service.detalhar(138643);
      expect(disponibilidade.executarSql).toHaveBeenCalledTimes(1);
      const [sql, binds, cfg, limite] = disponibilidade.executarSql.mock
        .calls[0] as [string, Record<string, unknown>, unknown, number];
      // Inline view sobre o SQL vigente: o contrato de colunas (e correção de schema do
      // Consultas BD) vale também no detalhe, sem duplicar a consulta.
      expect(sql.startsWith('SELECT * FROM (')).toBe(true);
      expect(sql).toContain('SICLA.LISTA_ITEMPED');
      expect(sql).toContain('WHERE PEDIDO = :pedido');
      expect(sql).toContain('ORDER BY ITEM');
      expect(binds.pedido).toBe(138643);
      // O default referencia :data_ini/:data_fim — supridos com o intervalo total, para a
      // janela de criação não esconder uma RNS antiga.
      expect(binds.data_ini).toBe('1900-01-01');
      expect(binds.data_fim).toBe('2999-12-31');
      expect(cfg).toBeUndefined();
      expect(limite).toBe(LIMITE_DETALHE_RNS);
      expect(r.numero).toBe(138643);
      expect(r.total).toBe(1);
      expect(r.erro).toBeNull();
      expect(r.itens[0]).toMatchObject({ pedido: 138643, item: 1 });
    });

    it('SQL editado SEM os binds de data roda só com o :pedido (bind sobrando é ORA-01036)', async () => {
      consultas.porSlug.mockResolvedValue({
        sql: 'SELECT PEDIDO, ITEM FROM SICLA.LISTA_ITEMPED',
      });
      await service.detalhar(138643);
      const binds = disponibilidade.executarSql.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(binds).toEqual({ pedido: 138643 });
    });

    it('número inválido nem vai ao SICLA — devolve o erro amigável', async () => {
      for (const invalido of [0, -1, 1.5, NaN]) {
        const r = await service.detalhar(invalido);
        expect(r.erro).toBe('Número de RNS inválido.');
        expect(r.itens).toEqual([]);
      }
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });

    it('RNS inexistente devolve erro claro (o modal do calendário mostra a mensagem)', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [],
      });
      const r = await service.detalhar(999999);
      expect(r.erro).toContain('999999');
      expect(r.erro).toContain('não foi encontrada');
      expect(r.total).toBe(0);
    });

    it('sem conexão configurada devolve o erro amigável sem consultar', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.detalhar(138643);
      expect(r.erro).toContain('Ferramentas → Disponibilidade');
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });

    it('falha do SQL vira `erro` no resultado, não exceção', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      const r = await service.detalhar(138643);
      expect(r.erro).toBe('ORA-00942');
      expect(r.itens).toEqual([]);
    });
  });
});
