import { Test, TestingModule } from '@nestjs/testing';
import { DadosService } from '../dados/dados.service';
import { hojeIso, parseIso, toIso } from '../cronograma/datas.util';
import { MAX_DIAS_JANELA_RNS, RnsService } from './rns.service';
import { LIMITE_CONSULTA_RNS } from './rns.constants';
import { SQL_CONSULTA_RNS_PADRAO } from '../dados/catalogo/sql/sicla-rns.sql';

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
  const dados = { consultar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RnsService, { provide: DadosService, useValue: dados }],
    }).compile();
    service = module.get(RnsService);
    dados.consultar.mockResolvedValue({
      ok: true,
      mensagem: '',
      colunas: [],
      linhas: [linha()],
    });
  });

  // O bloco "consulta nomeada no Consultas BD" saiu daqui: semear o SQL e escolher o texto
  // vigente (default vs editado pelo Administrador) passaram a ser do catálogo da API de
  // Dados — cobertos em `dados/catalogo-seed.service.spec.ts` e `dados/dados.service.spec.ts`.
  // Este módulo não conhece mais SQL, bind nem teto de linhas.

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
    it('pede a consulta pelo NOME, com a janela pedida', async () => {
      await service.consultar({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(dados.consultar).toHaveBeenCalledWith('sicla.rns.listar', {
        data_ini: '2026-07-01',
        data_fim: '2026-09-30',
      });
    });

    it('a SEMENTE da consulta mantém o contrato de colunas da revisão de 2026-08-17', () => {
      // O texto vive no catálogo (dados/catalogo/sql/sicla-rns.sql) e é editável em
      // Consultas BD — mas o ponto de partida precisa continuar trazendo pais E filhas
      // (sem filtro de PEDIDOPAI) e os campos longos que a tela mostra.
      expect(SQL_CONSULTA_RNS_PADRAO).not.toContain('PEDIDOPAI');
      expect(SQL_CONSULTA_RNS_PADRAO).toContain('ITM.DETALHAMENTO');
      expect(SQL_CONSULTA_RNS_PADRAO).toContain('ITM.MOTIVO');
      expect(SQL_CONSULTA_RNS_PADRAO).toContain('ITM.PARECERENG');
      expect(SQL_CONSULTA_RNS_PADRAO).toContain('ORDER BY');
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
      dados.consultar.mockResolvedValue({
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
      dados.consultar.mockResolvedValue({
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
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem:
          'Conexão com o SICLA não configurada ou inativa (Sistema → Ferramentas → Disponibilidade).',
        colunas: [],
        linhas: [],
      });
      const r = await service.consultar({
        ini: '2026-07-01',
        fim: '2026-09-30',
      });
      expect(r.erro).toContain('Ferramentas → Disponibilidade');
      expect(r).toMatchObject({ ini: '2026-07-01', fim: '2026-09-30' });
      expect(r.itens).toEqual([]);
    });

    it('falha do SQL vira `erro` no resultado, não exceção', async () => {
      dados.consultar.mockResolvedValue({
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
    it('pede a consulta derivada, com o intervalo TOTAL de criação', async () => {
      const r = await service.detalhar(138643);
      expect(dados.consultar).toHaveBeenCalledTimes(1);
      // O recorte por PEDIDO (inline view + ORDER BY ITEM) é do catálogo (`envelopar`) —
      // coberto em dados.service.spec.ts. Daqui sai o número e a janela total, para a
      // janela de criação não esconder uma RNS antiga.
      expect(dados.consultar).toHaveBeenCalledWith('sicla.rns.detalhar', {
        pedido: 138643,
        data_ini: '1900-01-01',
        data_fim: '2999-12-31',
      });
      expect(r.numero).toBe(138643);
      expect(r.total).toBe(1);
      expect(r.erro).toBeNull();
      expect(r.itens[0]).toMatchObject({ pedido: 138643, item: 1 });
    });

    it('número inválido nem vai ao SICLA — devolve o erro amigável', async () => {
      for (const invalido of [0, -1, 1.5, NaN]) {
        const r = await service.detalhar(invalido);
        expect(r.erro).toBe('Número de RNS inválido.');
        expect(r.itens).toEqual([]);
      }
      expect(dados.consultar).not.toHaveBeenCalled();
    });

    it('RNS inexistente devolve erro claro (o modal do calendário mostra a mensagem)', async () => {
      dados.consultar.mockResolvedValue({
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

    it('sem conexão configurada devolve o erro amigável', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem:
          'Conexão com o SICLA não configurada ou inativa (Sistema → Ferramentas → Disponibilidade).',
        colunas: [],
        linhas: [],
      });
      const r = await service.detalhar(138643);
      expect(r.erro).toContain('Ferramentas → Disponibilidade');
    });

    it('falha do SQL vira `erro` no resultado, não exceção', async () => {
      dados.consultar.mockResolvedValue({
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
