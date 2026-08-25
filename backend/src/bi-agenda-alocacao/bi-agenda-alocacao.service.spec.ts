import { Test, TestingModule } from '@nestjs/testing';
import { BiAgendaAlocacaoService } from './bi-agenda-alocacao.service';
import { DadosService } from '../dados/dados.service';
import {} from './bi-agenda-alocacao.constants';
import {
  SQL_CALENDARIO_ALOCACAO,
  SQL_HORAS_APLICADAS,
} from '../dados/catalogo/sql/sicla-agenda.sql';

/** Linha CRUA de `POWERBI_IMP_LISTACOMPROMISSOS_2` — um compromisso, uma linha POR técnico. */
function compromisso(over: Record<string, unknown> = {}) {
  return {
    CODIGO: 1592242,
    DIA: '2026-07-23',
    HORA_INI: '13:00',
    HORA_FIM: '17:00',
    STATUS: 6,
    ASSUNTO: 'WLG DISTRIBUIDORA - CONVERSÃO FORNECEDORES',
    MINUTOS: 240,
    PEDIDOIMP: 138643,
    ESPECIE: 90,
    ESPECIEDES: 'Produção Interna Normal Apontada',
    TECNICO: 'Giomar',
    TIPO_SUPORTE: 'Implantação',
    FANTASIA: 'WLG Distribuidora',
    RNS_DESCRICAO: 'WLG - Implantação',
    GRUPO_ECONOMICO: 'WLG',
    ...over,
  };
}

/** Linha CRUA de `POWERBI_AGENDA_POSTERGACAO_IMP_2` — um compromisso com flag 0/1 por status. */
function agendaHoras(over: Record<string, unknown> = {}) {
  return {
    RNS: 138846,
    DATA_INI: '2026-07-15T11:30:00',
    DATA_FIM: '2026-07-15T14:30:00', // 3h
    ENCAMINHADA: 0,
    AGENDADA: 0,
    REALIZADA: 1,
    NAO_REALIZADA: 0,
    POSTERGADA: 0,
    CANCELADA: 0,
    FANTASIA: 'Cliente X',
    RNS_DESCRICAO: 'Cliente X - Implantação',
    RESPONSAVELDES: 'Kailan',
    TIPO_SUPORTE: 'Implantação',
    GRUPO_ECONOMICO: 'GRUPO X',
    ...over,
  };
}

describe('BiAgendaAlocacaoService', () => {
  let service: BiAgendaAlocacaoService;
  const dados = { consultar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiAgendaAlocacaoService,
        { provide: DadosService, useValue: dados },
      ],
    }).compile();
    service = module.get(BiAgendaAlocacaoService);
  });

  describe('Calendário', () => {
    beforeEach(() => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [compromisso()],
      });
    });

    it('não restringe por espécie nem tipo de suporte — são filtros do usuário, não regra fixa', () => {
      // Ao contrário de `ESPECIES_CALENDARIO` (bi-implantacao), aqui a inspeção do
      // Report/definition/report.json e das page.json do BI_Interno.pbix NÃO encontrou
      // nenhum filtro fixo de página/relatório restringindo ESPECIE ou TIPO_SUPORTE — os
      // dois são slicers livres. O SQL, portanto, não deve filtrar por eles.
      expect(SQL_CALENDARIO_ALOCACAO).not.toMatch(/ESPECIE\s+IN/i);
      expect(SQL_CALENDARIO_ALOCACAO).not.toMatch(/TIPO_SUPORTE\s*=/i);
    });

    it('converte o STATUS numérico no rótulo do vocabulário de agenda', async () => {
      const r = await service.calendario({ mes: '2026-07' });
      expect(
        r.dias.find((d) => d.dia === '2026-07-23')?.compromissos[0].status,
      ).toBe('6-Realizada');
    });

    it('liga PEDIDOIMP à RNS, mas não exige — compromisso sem RNS continua na grade', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [
          compromisso({ PEDIDOIMP: null, FANTASIA: null, RNS_DESCRICAO: null }),
        ],
      });
      const r = await service.calendario({ mes: '2026-07' });
      const c = r.dias.find((d) => d.dia === '2026-07-23')?.compromissos[0];
      expect(c?.rns).toBeNull();
      expect(c?.fantasia).toBe('');
    });

    it('conta compromissos DISTINTOS por código — um mesmo CODIGO com 2 técnicos não dobra o total', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          compromisso({ TECNICO: 'Alex' }),
          compromisso({ TECNICO: 'Clovis' }),
        ],
      });
      const r = await service.calendario({ mes: '2026-07' });
      expect(r.totalCompromissos).toBe(1);
    });

    it('filtra por técnico (dimensão "responsavel") em cascata', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          compromisso({ CODIGO: 1, TECNICO: 'Alex' }),
          compromisso({ CODIGO: 2, TECNICO: 'Clovis' }),
        ],
      });
      const r = await service.calendario({
        mes: '2026-07',
        responsavel: ['Alex'],
      });
      expect(r.totalCompromissos).toBe(1);
      // a própria dimensão mantém as duas opções…
      expect(r.filtros.responsaveis).toEqual(['Alex', 'Clovis']);
    });

    it('monta a grade com todos os dias do mês, mesmo sem compromisso', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '0',
        colunas: [],
        linhas: [],
      });
      const r = await service.calendario({ mes: '2026-02' }); // fevereiro/2026, 28 dias
      expect(r.dias).toHaveLength(28);
      expect(r.dias.every((d) => d.compromissos.length === 0)).toBe(true);
    });

    it('mês inválido cai no mês atual', async () => {
      const r = await service.calendario({ mes: 'não é mês' });
      expect(r.mes).toMatch(/^\d{4}-\d{2}$/);
    });

    it('avisa quando o SICLA não está configurado', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'Conexão com o SICLA não configurada ou inativa.',
        colunas: [],
        linhas: [],
      });
      const r = await service.calendario({ mes: '2026-07' });
      expect(r.erro).toContain('não configurada');
      expect(r.dias).toEqual([]);
    });
  });

  describe('Horas Aplicadas', () => {
    beforeEach(() => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [agendaHoras()],
      });
    });

    it('usa janela padrão de 24 meses, como os Indicadores (mesmo store no front)', () => {
      expect(service.periodo({ compFim: '2026-07' })).toEqual({
        inicio: '2024-07',
        fim: '2026-07',
      });
    });

    it('calcula a duração em horas de DATAFIM - DATAINI, não conta 1 por linha', async () => {
      const r = await service.horasAplicadas({});
      expect(r.linhas[0].horasRealizada).toBe(3); // 11:30 -> 14:30
      expect(r.linhas[0].horasTotal).toBe(3);
    });

    it('soma por status (flag 0/1) em vez de contar compromissos', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          agendaHoras({
            REALIZADA: 1,
            DATA_INI: '2026-07-01T08:00:00',
            DATA_FIM: '2026-07-01T10:00:00',
          }),
          agendaHoras({
            REALIZADA: 0,
            POSTERGADA: 1,
            DATA_INI: '2026-07-02T08:00:00',
            DATA_FIM: '2026-07-02T09:00:00',
          }),
        ],
      });
      const r = await service.horasAplicadas({});
      expect(r.linhas[0].horasRealizada).toBe(2);
      expect(r.linhas[0].horasPostergada).toBe(1);
      expect(r.linhas[0].horasTotal).toBe(3);
      expect(r.linhas[0].percentualPostergada).toBeCloseTo(33.33, 1);
    });

    it('agrupa por RNS — duas linhas da mesma RNS viram UMA linha na tabela', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          agendaHoras({ RNS: 100 }),
          agendaHoras({
            RNS: 100,
            DATA_INI: '2026-07-16T08:00:00',
            DATA_FIM: '2026-07-16T09:00:00',
          }),
          agendaHoras({ RNS: 200 }),
        ],
      });
      const r = await service.horasAplicadas({});
      expect(r.linhas).toHaveLength(2);
      expect(r.linhas.find((l) => l.rns === 100)?.qtdCompromissos).toBe(2);
    });

    it('compromisso sem RNS não entra na tabela por projeto', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [agendaHoras({ RNS: null })],
      });
      const r = await service.horasAplicadas({});
      expect(r.linhas).toHaveLength(0);
    });

    it('data invertida ou zerada não gera hora negativa', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [
          agendaHoras({
            DATA_INI: '2026-07-15T14:30:00',
            DATA_FIM: '2026-07-15T11:30:00',
          }),
        ],
      });
      const r = await service.horasAplicadas({});
      expect(r.linhas[0].horasRealizada).toBe(0);
    });

    it('filtra por grupo econômico em cascata', async () => {
      dados.consultar.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          agendaHoras({ RNS: 100, GRUPO_ECONOMICO: 'A' }),
          agendaHoras({ RNS: 200, GRUPO_ECONOMICO: 'B' }),
        ],
      });
      const r = await service.horasAplicadas({ grupo: ['A'] });
      expect(r.linhas.map((l) => l.rns)).toEqual([100]);
      expect(r.filtros.grupos).toEqual(['A', 'B']);
    });

    it('avisa quando o SICLA não está configurado', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'Conexão com o SICLA não configurada ou inativa.',
        colunas: [],
        linhas: [],
      });
      const r = await service.horasAplicadas({});
      expect(r.erro).toContain('não configurada');
      expect(r.linhas).toEqual([]);
    });

    it('propaga erro do banco', async () => {
      dados.consultar.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      expect((await service.horasAplicadas({})).erro).toContain('ORA-00942');
    });

    it('o SQL soma por status a partir de duas datas, não conta 1 por linha', () => {
      expect(SQL_HORAS_APLICADAS).toContain(
        'POWERBI.POWERBI_AGENDA_POSTERGACAO_IMP_2',
      );
      expect(SQL_HORAS_APLICADAS).toContain('DATAINI');
      expect(SQL_HORAS_APLICADAS).toContain('DATAFIM');
    });
  });
});
