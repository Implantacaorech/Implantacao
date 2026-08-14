import { Test, TestingModule } from '@nestjs/testing';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { UsersService } from '../users/users.service';
import { hojeIso } from '../cronograma/datas.util';
import { AgendaService, MAX_DIAS_JANELA } from './agenda.service';

/** Linha CRUA de `POWERBI_IMP_LISTACOMPROMISSOS_2` — uma linha POR técnico do compromisso
 * (mesmo molde do spec do BI `bi-agenda-alocacao`, que lê a mesma view). */
function compromisso(over: Record<string, unknown> = {}) {
  return {
    CODIGO: 1592242,
    DIA: '2026-08-12',
    HORA_INI: '13:00',
    HORA_FIM: '17:00',
    STATUS: 3,
    ASSUNTO: 'Treinamento de faturamento',
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

describe('AgendaService (tela Execução → Agenda)', () => {
  let service: AgendaService;
  const disponibilidade = { configurado: jest.fn(), executarSql: jest.fn() };
  const users = { listar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    users.listar.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendaService,
        { provide: DisponibilidadeService, useValue: disponibilidade },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(AgendaService);
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.executarSql.mockResolvedValue({
      ok: true,
      mensagem: '',
      colunas: [],
      linhas: [compromisso()],
    });
  });

  describe('usuarios (filtro de técnicos da tela)', () => {
    it('devolve só ativos com nome, e SÓ id e nome — nada do resto do cadastro', async () => {
      users.listar.mockResolvedValue([
        { id: 1, nome: 'Liliana Côrtes', ativo: true, senhaHash: 'x', email: 'l@r' },
        { id: 2, nome: 'Alex Ramos', ativo: false, senhaHash: 'y' },
        { id: 3, nome: '   ', ativo: true },
        { id: 4, nome: ' Bruna Prado ', ativo: true },
      ]);
      const r = await service.usuarios();
      expect(r).toEqual([
        { id: 1, nome: 'Liliana Côrtes' },
        { id: 4, nome: 'Bruna Prado' },
      ]);
    });
  });

  describe('janela (periodo)', () => {
    it('sem parâmetros cai na semana de HOJE, domingo→sábado (o desenho da grade)', () => {
      const { ini, fim } = service.periodo({});
      const hoje = hojeIso();
      expect(ini <= hoje && hoje <= fim).toBe(true);
      expect(new Date(`${ini}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(new Date(`${fim}T00:00:00Z`).getUTCDay()).toBe(6);
    });

    it('só `ini` completa a semana que começa nele; invertida é ordenada', () => {
      expect(service.periodo({ ini: '2026-08-09' })).toEqual({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(service.periodo({ ini: '2026-08-31', fim: '2026-08-01' })).toEqual(
        { ini: '2026-08-01', fim: '2026-08-31' },
      );
    });

    it('data inválida (2026-13-45) não passa — vira o default', () => {
      const { ini } = service.periodo({ ini: '2026-13-45' });
      expect(new Date(`${ini}T00:00:00Z`).getUTCDay()).toBe(0);
    });

    it(`janela maior que ${MAX_DIAS_JANELA} dias é aparada pelo fim`, () => {
      const { ini, fim } = service.periodo({
        ini: '2026-01-01',
        fim: '2026-12-31',
      });
      expect(ini).toBe('2026-01-01');
      expect(fim).toBe('2026-03-03'); // 62º dia a partir de 01/01 (inclusive)
    });
  });

  describe('calendario', () => {
    it('consulta o SICLA com fim EXCLUSIVO (dia seguinte ao fim da janela)', async () => {
      await service.calendario({ ini: '2026-08-09', fim: '2026-08-15' });
      expect(disponibilidade.executarSql).toHaveBeenCalledWith(
        expect.stringContaining('POWERBI_IMP_LISTACOMPROMISSOS_2'),
        { mes_ini: '2026-08-09', mes_fim: '2026-08-16' },
        undefined,
        expect.any(Number),
      );
    });

    it('devolve um item POR DIA da janela, mesmo os vazios, com os compromissos por hora', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          compromisso({ HORA_INI: '14:00' }),
          compromisso({ CODIGO: 2, HORA_INI: '08:00', STATUS: 6 }),
        ],
      });
      const r = await service.calendario({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(r.dias).toHaveLength(7);
      expect(r.dias[0]).toMatchObject({ dia: '2026-08-09', diaSemana: 0 });
      const dia12 = r.dias.find((d) => d.dia === '2026-08-12');
      expect(dia12?.compromissos.map((c) => c.horaIni)).toEqual([
        '08:00',
        '14:00',
      ]);
      expect(dia12?.compromissos[1].status).toBe('3-Agendada');
    });

    it('conta compromissos DISTINTOS por código — 2 técnicos no mesmo não dobram', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          compromisso({ TECNICO: 'Giomar' }),
          compromisso({ TECNICO: 'Liliana' }),
        ],
      });
      const r = await service.calendario({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(r.totalCompromissos).toBe(1);
      expect(r.responsaveis).toEqual(['Giomar', 'Liliana']);
    });

    it('resume por status com cor e percentual', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '',
        colunas: [],
        linhas: [
          compromisso(),
          compromisso({ CODIGO: 2, STATUS: 6 }),
          compromisso({ CODIGO: 3, STATUS: 6 }),
        ],
      });
      const r = await service.calendario({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(r.resumo).toEqual([
        {
          status: '3-Agendada',
          quantidade: 1,
          percentual: 33.3,
          cor: '#E0FFE0',
        },
        {
          status: '6-Realizada',
          quantidade: 2,
          percentual: 66.7,
          cor: '#FFF5E0',
        },
      ]);
    });

    it('sem conexão configurada devolve o erro amigável e a janela pedida', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.calendario({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(r.erro).toContain('Ferramentas → Disponibilidade');
      expect(r).toMatchObject({ ini: '2026-08-09', fim: '2026-08-15' });
      expect(r.dias).toEqual([]);
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });

    it('falha do SQL vira `erro` no resultado, não exceção', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      const r = await service.calendario({
        ini: '2026-08-09',
        fim: '2026-08-15',
      });
      expect(r.erro).toBe('ORA-00942');
      expect(r.dias).toEqual([]);
    });
  });
});
