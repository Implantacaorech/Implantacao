import { Test, TestingModule } from '@nestjs/testing';
import { BiMovimentosService } from './bi-movimentos.service';
import { DadosService } from '../dados/dados.service';
import { SQL_MOVIMENTOS_AGRUPADOS } from '../dados/catalogo/sql/sicla-bi.sql';

/** Linha CRUA já agregada pelo SQL (GROUP BY técnico/tipo de movimento/cobrança) — espelha o
 * que a consulta real devolveu numa janela de 30 dias (THOMAZ/VISITAS/Não, 22 movimentos,
 * 3.168 minutos). */
function grupo(over: Record<string, unknown> = {}) {
  return {
    TECNICODES: 'THOMAZ',
    TP_MOVIMENTO: 'VISITAS',
    COBRA_HORA: 'Não',
    QTD: 22,
    MIN_TOTAL: 3168,
    MIN_COBRADO: 3168,
    ...over,
  };
}

describe('BiMovimentosService', () => {
  let service: BiMovimentosService;
  const dados = { consultar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiMovimentosService,
        { provide: DadosService, useValue: dados },
      ],
    }).compile();
    service = module.get(BiMovimentosService);
    dados.consultar.mockResolvedValue({
      ok: true,
      mensagem: '1',
      colunas: [],
      linhas: [grupo()],
    });
  });

  describe('período', () => {
    it('usa janela padrão de 3 meses (mais curta que o resto do BI, de propósito)', () => {
      const p = service.periodo({ dataFim: '2026-07-29' });
      expect(p.inicio).toBe('2026-04-29');
      expect(p.fim).toBe('2026-07-29');
      expect(p.limitado).toBe(false);
    });

    it('recorta janelas maiores que 6 meses e avisa via `limitado`', () => {
      const p = service.periodo({
        dataIni: '2025-01-01',
        dataFim: '2026-07-29',
      });
      expect(p.inicio).toBe('2026-01-29'); // 6 meses antes do fim
      expect(p.limitado).toBe(true);
    });

    it('inverte quando início vem depois do fim', () => {
      const p = service.periodo({
        dataIni: '2026-07-29',
        dataFim: '2026-01-01',
      });
      expect(p.inicio <= p.fim).toBe(true);
    });

    it('manda o período ao SQL como data exclusiva (fim + 1 dia)', async () => {
      await service.movimentos({
        dataIni: '2026-01-01',
        dataFim: '2026-01-31',
      });
      expect(dados.consultar).toHaveBeenCalledWith('sicla.bi.movimentos', {
        data_ini: '2026-01-01',
        data_fim: '2026-02-01',
      });
    });
  });

  describe('normalização e agregação', () => {
    it('converte minutos em horas decimais', async () => {
      const r = await service.movimentos({});
      expect(r.totais.horasTotal).toBe(52.8); // 3168/60
      expect(r.totais.horasCobradas).toBe(52.8);
    });

    it('COBRA_HORA "Sim"/"Não" vira booleano — não confundir com o filtro de status de outra página', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [grupo({ COBRA_HORA: 'Sim' })],
      });
      const r = await service.movimentos({});
      expect(r.porTecnico[0].horasCobradas).toBe(52.8);
    });

    it('horas não cobradas = total - cobradas quando MINCOBRADO diverge (ex.: PENDENCIA)', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [
          grupo({ TP_MOVIMENTO: 'PENDENCIA', MIN_TOTAL: 537, MIN_COBRADO: 0 }),
        ],
      });
      const r = await service.movimentos({});
      expect(r.porTpMovimento[0].horasTotal).toBe(8.95); // 537/60
      expect(r.porTpMovimento[0].horasCobradas).toBe(0);
      expect(r.porTpMovimento[0].horasNaoCobradas).toBe(8.95);
    });

    it('agrupa por técnico e por tipo de movimento, somando quem repete', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          grupo({
            TECNICODES: 'ALAN',
            TP_MOVIMENTO: 'AGENDA',
            MIN_TOTAL: 600,
            MIN_COBRADO: 600,
            QTD: 5,
          }),
          grupo({
            TECNICODES: 'ALAN',
            TP_MOVIMENTO: 'RNS',
            MIN_TOTAL: 60,
            MIN_COBRADO: 0,
            QTD: 2,
          }),
        ],
      });
      const r = await service.movimentos({});
      expect(r.porTecnico).toHaveLength(1);
      expect(r.porTecnico[0].chave).toBe('ALAN');
      expect(r.porTecnico[0].horasTotal).toBe(11); // (600+60)/60
      expect(r.porTecnico[0].quantidade).toBe(7);
      expect(r.porTpMovimento.map((p) => p.chave).sort()).toEqual([
        'AGENDA',
        'RNS',
      ]);
    });

    it('conta técnicos distintos', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [grupo({ TECNICODES: 'ALAN' }), grupo({ TECNICODES: 'ANA' })],
      });
      const r = await service.movimentos({});
      expect(r.totais.tecnicos).toBe(2);
    });
  });

  describe('filtros', () => {
    it('filtra por técnico em cascata', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [grupo({ TECNICODES: 'ALAN' }), grupo({ TECNICODES: 'ANA' })],
      });
      const r = await service.movimentos({ tecnico: ['ALAN'] });
      expect(r.porTecnico.map((p) => p.chave)).toEqual(['ALAN']);
      expect(r.filtros.tecnicos).toEqual(['ALAN', 'ANA']); // a própria dimensão mantém as duas
    });

    it('filtra por cobra_hora traduzindo o booleano de volta para Sim/Não', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          grupo({ TECNICODES: 'ALAN', COBRA_HORA: 'Sim' }),
          grupo({ TECNICODES: 'ANA', COBRA_HORA: 'Não' }),
        ],
      });
      const r = await service.movimentos({ cobraHora: ['Sim'] });
      expect(r.porTecnico.map((p) => p.chave)).toEqual(['ALAN']);
    });

    it('filtro vazio significa todos', async () => {
      const r = await service.movimentos({ tecnico: [] });
      expect(r.porTecnico).toHaveLength(1);
    });
  });

  it('avisa quando o SICLA não está configurado', async () => {
    dados.consultar.mockResolvedValue({
      ok: false,
      mensagem: 'Conexão com o SICLA não configurada ou inativa.',
      colunas: [],
      linhas: [],
    });
    const r = await service.movimentos({});
    expect(r.erro).toContain('não configurada');
    expect(r.porTecnico).toEqual([]);
  });

  it('propaga erro do banco', async () => {
    dados.consultar.mockResolvedValue({
      ok: false,
      mensagem: 'ORA-00942',
      colunas: [],
      linhas: [],
    });
    expect((await service.movimentos({})).erro).toContain('ORA-00942');
  });

  it('o SQL já agrupa no Oracle (GROUP BY), não busca linha crua', () => {
    expect(SQL_MOVIMENTOS_AGRUPADOS).toContain('GROUP BY');
    expect(SQL_MOVIMENTOS_AGRUPADOS).toContain(
      'POWERBI.POWERBI_APONTAMENTO_TECNICOS',
    );
    expect(SQL_MOVIMENTOS_AGRUPADOS).toContain('a.DTINICIO');
  });
});
