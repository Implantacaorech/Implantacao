import { Test, TestingModule } from '@nestjs/testing';
import { BiIndicadoresService } from './bi-indicadores.service';
import { DadosService } from '../dados/dados.service';
import { SQL_INDICADORES } from '../dados/catalogo/sql/sicla-bi.sql';

/** Linha CRUA da view `POWERBI_IMP_RNIMPLANTACAO_2`: datas em TEXTO `DD/MM/YYYY`,
 * competências em `AAAA/MM` e horas em MINUTOS. */
function linha(over: Record<string, unknown> = {}) {
  return {
    CODIGO: 138937,
    DESCRICAO: 'PLAQUES RS - Controladoria',
    CLIENTE: 3729,
    FANTASIA: 'PLAQUES RS',
    RESPONSAVELDES: 'Kailan',
    REPRESENDES: 'Paim',
    DT_CONTRATACAO: '27/07/2026',
    DT_ENCERRAMENTO: '10/10/2026',
    DT_CRIACAO: '28/07/2026',
    COMP_CONTRATACAO: '2026/07',
    COMP_ENCERRAMENTO: '2026/10',
    DT_PREVISAO_USO: '2026-09-01',
    DT_TRANSICAO: null,
    MIN_CONTRATADOS: 6480, // 108h
    MIN_REALIZADOS: 3240, // 54h
    MIN_SALDO: 3240,
    MIN_COBRADOS: 600,
    MIN_BONIFICADOS: 1200,
    MIN_COBRADOS_AD: 60,
    MIN_BONIFICADOS_AD: 120,
    POSICAO: '6-Concluída',
    TIPO_IMPLANTACAO: '1-Implantação',
    AREA: 'X',
    TIPO_SUPORTE: 'Implantação',
    STATUSIMP: 6,
    GRUPO_ECONOMICO: 'MANTAS BRASIL',
    ...over,
  };
}

describe('BiIndicadoresService', () => {
  let service: BiIndicadoresService;
  const dados = { consultar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiIndicadoresService,
        { provide: DadosService, useValue: dados },
      ],
    }).compile();
    service = module.get(BiIndicadoresService);
    dados.consultar.mockResolvedValue({
      ok: true,
      mensagem: '1',
      colunas: [],
      linhas: [linha()],
    });
  });

  describe('período', () => {
    it('usa janela padrão de 24 meses', () => {
      expect(service.periodo({ compFim: '2026-07' })).toEqual({
        inicio: '2024-07',
        fim: '2026-07',
      });
    });

    it('vira o ano ao recuar', () => {
      expect(service.periodo({ compFim: '2026-01' }).inicio).toBe('2024-01');
    });

    it('inverte quando início vem depois do fim', () => {
      expect(
        service.periodo({ compIni: '2026-12', compFim: '2026-01' }),
      ).toEqual({
        inicio: '2026-01',
        fim: '2026-12',
      });
    });

    it('competência inválida cai no padrão', () => {
      expect(
        service.periodo({ compIni: '07/2026', compFim: '2026-07' }).inicio,
      ).toBe('2024-07');
    });

    it('pede a consulta pelo NOME, com a competência em AAAA-MM', async () => {
      await service.indicadores({ compIni: '2026-01', compFim: '2026-07' });
      // A conversão para o AAAA/MM que a view guarda é do catálogo (tipo `competencia`) —
      // este módulo não conhece mais o formato interno da view.
      expect(dados.consultar).toHaveBeenCalledWith('sicla.bi.indicadores', {
        comp_ini: '2026-01',
        comp_fim: '2026-07',
      });
    });
  });

  describe('normalização', () => {
    it('converte data DD/MM/YYYY em ISO', async () => {
      const r = await service.indicadores({});
      expect(r.linhas[0].dataContratacao).toBe('2026-07-27');
      expect(r.linhas[0].dataEncerramento).toBe('2026-10-10');
    });

    it('converte competência AAAA/MM em AAAA-MM', async () => {
      const r = await service.indicadores({});
      expect(r.linhas[0].competenciaContratacao).toBe('2026-07');
      expect(r.linhas[0].competenciaEncerramento).toBe('2026-10');
    });

    it('data fora do padrão não derruba a linha', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [
          linha({ DT_CONTRATACAO: '2026-07-27', DT_ENCERRAMENTO: 'sujo' }),
        ],
      });
      const r = await service.indicadores({});
      expect(r.linhas[0].dataContratacao).toBe('');
      expect(r.linhas[0].leadTimeMeses).toBeNull();
    });

    it('converte MINUTOS em horas decimais', async () => {
      const r = await service.indicadores({});
      expect(r.linhas[0].horasContratadas).toBe(108);
      expect(r.linhas[0].horasRealizadas).toBe(54);
    });

    it('soma as horas ADICIONAIS às cobradas e bonificadas', async () => {
      const r = await service.indicadores({});
      expect(r.linhas[0].horasCobradas).toBe(11); // (600+60)/60
      expect(r.linhas[0].horasBonificadas).toBe(22); // (1200+120)/60
    });

    it('calcula o % de utilização por projeto', async () => {
      const r = await service.indicadores({});
      expect(r.linhas[0].percentualUtilizacao).toBe(50);
    });

    it('percentual é null sem horas contratadas', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [linha({ MIN_CONTRATADOS: 0 })],
      });
      const r = await service.indicadores({});
      expect(r.linhas[0].percentualUtilizacao).toBeNull();
    });
  });

  describe('conclusão', () => {
    // "Concluída" é a POSIÇÃO, não a existência de data de encerramento: há RNS com
    // encerramento PREVISTO preenchido que ainda não concluíram.
    it('considera concluída pela POSIÇÃO, não pela data de encerramento', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          linha({ CODIGO: 1, POSICAO: '6-Concluída' }),
          linha({
            CODIGO: 2,
            POSICAO: '3-Em treinamento',
            DT_ENCERRAMENTO: '10/10/2026',
          }),
        ],
      });
      const r = await service.indicadores({});
      expect(r.linhas.map((l) => l.concluida)).toEqual([true, false]);
      expect(r.totais.concluidos).toBe(1);
      // a série de conclusão só conta a que realmente concluiu
      expect(r.porMesConclusao.reduce((a, m) => a + m.projetos, 0)).toBe(1);
    });

    it('calcula lead-time em meses entre contratação e encerramento', async () => {
      const r = await service.indicadores({});
      // 27/07 -> 10/10 = ~2,5 meses
      expect(r.linhas[0].leadTimeMeses).toBeCloseTo(2.43, 1);
      expect(r.totais.leadTimeMedio).toBeCloseTo(2.43, 1);
    });

    it('lead-time médio é null quando ninguém encerrou', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [linha({ DT_ENCERRAMENTO: null })],
      });
      const r = await service.indicadores({});
      expect(r.totais.leadTimeMedio).toBeNull();
    });
  });

  describe('séries e totais', () => {
    it('agrupa por competência de contratação, em ordem cronológica', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '3',
        colunas: [],
        linhas: [
          linha({ CODIGO: 1, COMP_CONTRATACAO: '2026/07' }),
          linha({ CODIGO: 2, COMP_CONTRATACAO: '2026/06' }),
          linha({ CODIGO: 3, COMP_CONTRATACAO: '2026/06' }),
        ],
      });
      const r = await service.indicadores({});
      expect(r.porMesContratacao.map((m) => m.competencia)).toEqual([
        '2026-06',
        '2026-07',
      ]);
      expect(r.porMesContratacao[0].projetos).toBe(2);
    });

    it('linha sem competência não vira barra fantasma no gráfico', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          linha({ CODIGO: 1 }),
          linha({ CODIGO: 2, COMP_CONTRATACAO: null }),
        ],
      });
      const r = await service.indicadores({});
      expect(r.porMesContratacao).toHaveLength(1);
      expect(r.linhas).toHaveLength(2); // mas a linha continua na tabela
    });

    it('totaliza horas, clientes distintos e % de utilização', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          linha({
            CODIGO: 1,
            CLIENTE: 10,
            MIN_CONTRATADOS: 6000,
            MIN_REALIZADOS: 3000,
          }),
          linha({
            CODIGO: 2,
            CLIENTE: 10,
            MIN_CONTRATADOS: 6000,
            MIN_REALIZADOS: 1500,
          }),
        ],
      });
      const r = await service.indicadores({});
      expect(r.totais.projetos).toBe(2);
      expect(r.totais.clientes).toBe(1); // mesmo cliente nas duas
      expect(r.totais.horasContratadas).toBe(200);
      expect(r.totais.horasRealizadas).toBe(75);
      expect(r.totais.percentualUtilizacao).toBe(37.5);
    });
  });

  describe('filtros', () => {
    it('aplica seleção e mantém a própria dimensão completa (cascata)', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          linha({
            CODIGO: 1,
            POSICAO: '6-Concluída',
            RESPONSAVELDES: 'Kailan',
          }),
          linha({ CODIGO: 2, POSICAO: '7-Parada', RESPONSAVELDES: 'Jolemar' }),
        ],
      });
      const r = await service.indicadores({ posicao: ['6-Concluída'] });
      expect(r.linhas.map((l) => l.codigo)).toEqual([1]);
      // a dimensão filtrada mantém as opções…
      expect(r.filtros.posicoes).toEqual(['6-Concluída', '7-Parada']);
      // …e as outras encolhem
      expect(r.filtros.responsaveis).toEqual(['Kailan']);
    });

    it('filtro vazio significa todos', async () => {
      const r = await service.indicadores({ posicao: [], area: [''] });
      expect(r.linhas).toHaveLength(1);
    });
  });

  it('propaga o erro que a API de Dados devolve — banco fora ou conexão inativa', async () => {
    // Depois da migração há UM caminho de falha: `consultar` devolve {ok:false} tanto para
    // erro do Oracle quanto para conexão não cadastrada, com a mensagem que diz o que fazer.
    dados.consultar.mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    expect((await service.indicadores({})).erro).toContain('ORA-00942');

    dados.consultar.mockResolvedValue({
      ok: false,
      mensagem: 'Conexão com o SICLA não configurada ou inativa.',
      colunas: [],
      linhas: [],
    });
    const r = await service.indicadores({});
    expect(r.erro).toContain('não configurada');
    expect(r.linhas).toEqual([]);
  });

  it('o SQL cita a view do BI_Interno e trata os nomes com espaço', () => {
    expect(SQL_INDICADORES).toContain('POWERBI.POWERBI_IMP_RNIMPLANTACAO_2');
    expect(SQL_INDICADORES).toContain('"MINUTOS CONTRATADOS (DEC)"');
    expect(SQL_INDICADORES).toContain('"POSIÇÃO IMPLANTAÇÃO"');
  });
});
