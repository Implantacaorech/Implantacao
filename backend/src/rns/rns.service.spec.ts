import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { hojeIso, parseIso, toIso } from '../cronograma/datas.util';
import {
  MAX_DIAS_JANELA_RNS,
  RnsService,
} from './rns.service';
import { LIMITE_CONSULTA_RNS } from './rns.constants';

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
    ...over,
  };
}

describe('RnsService (tela Execução → RNS)', () => {
  let service: RnsService;
  const disponibilidade = { configurado: jest.fn(), executarSql: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RnsService,
        { provide: DisponibilidadeService, useValue: disponibilidade },
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
  });

  describe('janela (periodo)', () => {
    it('sem parâmetros cai em [1º dia do mês anterior, último dia do mês seguinte]', () => {
      const { ini, fim } = service.periodo({});
      const hoje = parseIso(hojeIso());
      expect(ini).toBe(
        toIso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1))),
      );
      expect(fim).toBe(
        toIso(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 2, 0))),
      );
      expect(ini <= hojeIso() && hojeIso() <= fim).toBe(true);
    });

    it('datas informadas valem como vieram; invertida é ordenada', () => {
      expect(service.periodo({ ini: '2026-07-01', fim: '2026-09-30' })).toEqual({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(service.periodo({ ini: '2026-09-30', fim: '2026-07-01' })).toEqual({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
    });

    it('data inválida (2026-13-45) não passa — vira o default daquele lado', () => {
      const { ini } = service.periodo({ ini: '2026-13-45' });
      expect(ini.endsWith('-01')).toBe(true);
    });

    it(`janela maior que ${MAX_DIAS_JANELA_RNS} dias é aparada pelo fim`, () => {
      const { ini, fim } = service.periodo({ ini: '2024-01-01', fim: '2026-12-31' });
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
      // O recorte de negócio da consulta original continua no SQL.
      const sql = disponibilidade.executarSql.mock.calls[0][0] as string;
      expect(sql).toContain('PEDIDOPAI IS NULL');
      expect(sql).toContain('ORDER BY');
    });

    it('normaliza a linha crua: Pedido+Item numéricos, rótulos aparados, datas AAAA-MM-DD', async () => {
      const r = await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
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
        linhas: [linha({ PRIORIDADE: null, VALOR_COB: null, SUBTIPO: null, DATAPREVISTA: null })],
      });
      const r = await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
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
      const r = await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(r.truncado).toBe(true);
      expect(r.total).toBe(LIMITE_CONSULTA_RNS);
    });

    it('sem conexão configurada devolve o erro amigável e a janela pedida', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
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
      const r = await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(r.erro).toBe('ORA-00942');
      expect(r.itens).toEqual([]);
    });
  });
});
