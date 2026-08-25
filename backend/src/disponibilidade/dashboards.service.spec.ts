import { Test, TestingModule } from '@nestjs/testing';
import { DashboardsService } from './dashboards.service';
import { ConsultaBdService } from '../dados/consulta-bd.service';
import { DadosService } from '../dados/dados.service';

describe('DashboardsService', () => {
  let service: DashboardsService;
  const consultas = { listar: jest.fn(), porSlug: jest.fn() };
  // O motor de dashboards roda SQL do ADMINISTRADOR (Consultas BD), não do catálogo — daí
  // o escape hatch, que também é quem checa a conexão e audita.
  const dados = { executarSqlDeAdministrador: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardsService,
        { provide: ConsultaBdService, useValue: consultas },
        { provide: DadosService, useValue: dados },
      ],
    }).compile();
    service = module.get(DashboardsService);
  });

  describe('periodo', () => {
    it('avançar: início = ref, fim exclusivo = ref + n meses', () => {
      const p = service.periodo({ ref: '2026-01', n: 3, direcao: 'avancar' });
      expect(p.inicio).toBe('2026-01-01');
      expect(p.fimExclusivo).toBe('2026-04-01');
      expect(p.fim).toBe('2026-03-31');
    });

    it('recuar: fim exclusivo = ref, início = ref - n meses', () => {
      const p = service.periodo({ ref: '2026-01', n: 3, direcao: 'recuar' });
      expect(p.inicio).toBe('2025-10-01');
      expect(p.fimExclusivo).toBe('2026-01-01');
    });

    it('vira o ano corretamente (dezembro + 1 mês)', () => {
      const p = service.periodo({ ref: '2026-12', n: 1, direcao: 'avancar' });
      expect(p.fimExclusivo).toBe('2027-01-01');
    });

    it('ref inválida cai no mês atual; n é limitado a [1,60]', () => {
      const p1 = service.periodo({ ref: 'lixo', n: 999 });
      expect(p1.n).toBe(60);
      const p2 = service.periodo({ n: -5 });
      expect(p2.n).toBe(1);
    });
  });

  describe('mesesDoPeriodo / atalhosMes', () => {
    it('lista os meses em ordem cronológica, cruzando o ano', () => {
      const periodo = service.periodo({
        ref: '2026-11',
        n: 4,
        direcao: 'avancar',
      });
      const meses = service.mesesDoPeriodo(periodo);
      expect(meses.map((m) => `${m.ano}-${m.mes}`)).toEqual([
        '2026-11',
        '2026-12',
        '2027-1',
        '2027-2',
      ]);
    });

    it('atalhos mapeia cada mês (1ª ocorrência) ao seu ano dentro do período', () => {
      const periodo = service.periodo({
        ref: '2026-11',
        n: 4,
        direcao: 'avancar',
      });
      const meses = service.mesesDoPeriodo(periodo);
      const atalhos = service.atalhosMes(meses);
      expect(atalhos[11]).toBe(2026);
      expect(atalhos[1]).toBe(2027);
    });
  });

  describe('rodar — motor genérico', () => {
    const CONSULTA = {
      id: 1,
      slug: 'previsao_inicio_oficial',
      nome: 'Previsão Início Oficial',
      sql: 'SELECT ...',
      ordem: 1,
      colunaData: 'PREVISAO_INICIO_OFICIAL',
      colunaSituacao: 'SITUACAO',
      mostrarGrafico: true,
    };

    it('consulta inexistente devolve erro sem chamar a conexão externa', async () => {
      consultas.porSlug.mockResolvedValue(null);
      const r = await service.rodar('nao-existe', {});
      expect(r.erro).toContain('não configurada');
      expect(dados.executarSqlDeAdministrador).not.toHaveBeenCalled();
    });

    it('conexão externa inativa devolve o erro que a API de Dados formulou', async () => {
      consultas.porSlug.mockResolvedValue(CONSULTA);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: false,
        mensagem:
          'Conexão com o SICLA não configurada ou inativa (Sistema → Ferramentas → Disponibilidade).',
        colunas: [],
        linhas: [],
      });
      const r = await service.rodar('previsao_inicio_oficial', {});
      expect(r.erro).toContain('não configurada');
    });

    it('filtra por período, agrupa por mês, monta o gráfico e a lista de situações', async () => {
      consultas.porSlug.mockResolvedValue(CONSULTA);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: true,
        mensagem: '2 linha(s).',
        colunas: [],
        linhas: [
          {
            CODIGO: 'A1',
            PREVISAO_INICIO_OFICIAL: '2026-01-15',
            SITUACAO: 'Em andamento',
          },
          {
            CODIGO: 'A2',
            PREVISAO_INICIO_OFICIAL: '2026-02-10',
            SITUACAO: 'Concluído',
          },
          // fora do período (fim exclusivo) — não deve entrar
          {
            CODIGO: 'A3',
            PREVISAO_INICIO_OFICIAL: '2026-04-01',
            SITUACAO: 'Em andamento',
          },
        ],
      });

      const r = await service.rodar('previsao_inicio_oficial', {
        ref: '2026-01',
        n: 3,
      });
      expect(r.erro).toBeNull();
      expect(r.linhasTabela).toHaveLength(2);
      expect(r.situacoesDisponiveis).toEqual(['Concluído', 'Em andamento']);
      expect(r.grafico).toEqual({
        labels: ['janeiro', 'fevereiro', 'março'],
        valores: [1, 1, 0],
      });
      expect(r.totalPeriodo).toBe(2);

      const [conexaoUsada, , bindsChamados] =
        dados.executarSqlDeAdministrador.mock.calls[0];
      expect(conexaoUsada).toBe('sicla');
      expect(bindsChamados).toEqual({
        data_ini: '2026-01-01',
        data_fim: '2026-03-31',
      });
    });

    it('filtro de situação na URL restringe a tabela e o total, mas não o gráfico geral', async () => {
      consultas.porSlug.mockResolvedValue(CONSULTA);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          { PREVISAO_INICIO_OFICIAL: '2026-01-15', SITUACAO: 'Em andamento' },
          { PREVISAO_INICIO_OFICIAL: '2026-01-20', SITUACAO: 'Concluído' },
        ],
      });
      const r = await service.rodar('previsao_inicio_oficial', {
        ref: '2026-01',
        n: 1,
        situacao: ['Concluído'],
      });
      expect(r.linhasTabela).toHaveLength(1);
      expect(r.linhasTabela[0].SITUACAO).toBe('Concluído');
    });

    it('mesSel/anoSel restringem só a tabela (o total de contagem por mês já foi calculado antes)', async () => {
      consultas.porSlug.mockResolvedValue(CONSULTA);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          { PREVISAO_INICIO_OFICIAL: '2026-01-15', SITUACAO: '' },
          { PREVISAO_INICIO_OFICIAL: '2026-02-10', SITUACAO: '' },
        ],
      });
      const r = await service.rodar('previsao_inicio_oficial', {
        ref: '2026-01',
        n: 2,
        mesSel: 2,
        anoSel: 2026,
      });
      expect(r.linhasTabela).toHaveLength(1);
      expect(r.grafico?.valores).toEqual([1, 1]); // gráfico não é afetado pelo mês selecionado
    });

    it('consulta sem colunaData nunca lista como dashboard, mas ainda roda via slug (linhas cruas, sem gráfico)', async () => {
      const consultaSemData = {
        ...CONSULTA,
        colunaData: '',
        colunaSituacao: '',
        mostrarGrafico: false,
      };
      consultas.listar.mockResolvedValue([consultaSemData]);
      consultas.porSlug.mockResolvedValue(consultaSemData);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [{ QUALQUER: 'coisa' }],
      });

      const disponiveis = await service.listarDisponiveis();
      expect(disponiveis).toHaveLength(0);

      const r = await service.rodar('qualquer', {});
      expect(r.grafico).toBeNull();
      expect(r.linhasTabela).toHaveLength(1);
    });

    it('erro na execução do SQL é repassado como erro do dashboard', async () => {
      consultas.porSlug.mockResolvedValue(CONSULTA);
      dados.executarSqlDeAdministrador.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00904: identificador inválido',
        colunas: [],
        linhas: [],
      });
      const r = await service.rodar('previsao_inicio_oficial', {});
      expect(r.erro).toContain('ORA-00904');
    });
  });
});
