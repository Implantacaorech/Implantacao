import { Test, TestingModule } from '@nestjs/testing';
import { BiImplantacaoService } from './bi-implantacao.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { ConsultaBdService } from '../disponibilidade/consulta-bd.service';
import {
  ESPECIES_CALENDARIO,
  NOME_CONSULTA_VISITAS_PORTAL,
  SLUG_CONSULTA_VISITAS_PORTAL,
  SQL_AGENDAS,
  SQL_VISITAS_PORTAL_PADRAO,
} from './bi-implantacao.constants';

/** Linhas no formato CRU que o driver Oracle devolve (colunas MAIÚSCULAS), como em
 * POWERBI.POWERBI_IMPLANTACAO_RESUMO. */
const LINHAS_ORACLE = [
  {
    CODIGO: 138935,
    CLIENTE: 3180,
    DESCRICAO: 'DEG - Adendo FAT e NFE',
    FANTASIA: 'DEG / DALCERO',
    TECNICO: 'Jolemar',
    STATUS_RNS: '1-Não inciado',
    TIPO: 2,
    DATA_CONTRATACAO: '2026-07-28',
    DATA_PREV_USO: null,
    DATA_ENCERRAMENTO: null,
    HORASPREVISTAS: 10,
    HORASREALIZADAS: 4,
    HORASALDO: 6,
    HORASCOBRADAS: 0,
    HORASCOBRADASADICIONAIS: 2,
    HORABONIFICADAS: 10,
    HORABONIFICADASADICIONAIS: 3,
    GRUPO_ECONOMICO: 'DEG / DALCERO',
    ATIVODES: 'Sim',
    TIPODES: 'Cliente',
  },
  {
    CODIGO: 138937,
    CLIENTE: 3729,
    DESCRICAO: 'PLAQUES RS - Controladoria',
    FANTASIA: 'PLAQUES RS',
    TECNICO: 'Kailan',
    STATUS_RNS: '6-Concluída',
    TIPO: 1,
    DATA_CONTRATACAO: '2026-06-27',
    DATA_PREV_USO: '2026-09-01',
    DATA_ENCERRAMENTO: '2026-07-01',
    HORASPREVISTAS: 30,
    HORASREALIZADAS: 30,
    HORASALDO: 0,
    HORASCOBRADAS: 30,
    HORASCOBRADASADICIONAIS: 0,
    HORABONIFICADAS: 0,
    HORABONIFICADASADICIONAIS: 0,
    GRUPO_ECONOMICO: 'MANTAS BRASIL',
    ATIVODES: 'Sim',
    TIPODES: 'Cliente',
  },
  {
    CODIGO: 138900,
    CLIENTE: 982,
    DESCRICAO: 'JES-MAHI - PWE',
    FANTASIA: 'JES-MAHI',
    TECNICO: 'Jolemar',
    STATUS_RNS: '6-Concluída',
    TIPO: 2,
    DATA_CONTRATACAO: '2026-06-10',
    DATA_PREV_USO: null,
    DATA_ENCERRAMENTO: null,
    HORASPREVISTAS: 0,
    HORASREALIZADAS: 0,
    HORASALDO: 0,
    HORASCOBRADAS: 0,
    HORASCOBRADASADICIONAIS: 0,
    HORABONIFICADAS: 0,
    HORABONIFICADASADICIONAIS: 0,
    GRUPO_ECONOMICO: 'JES-MAHI',
    ATIVODES: 'Não',
    TIPODES: 'Prospecto',
  },
];

describe('BiImplantacaoService', () => {
  let service: BiImplantacaoService;
  const disponibilidade = { configurado: jest.fn(), executarSql: jest.fn() };
  const consultas = { porSlug: jest.fn(), salvar: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiImplantacaoService,
        { provide: DisponibilidadeService, useValue: disponibilidade },
        { provide: ConsultaBdService, useValue: consultas },
      ],
    }).compile();
    service = module.get(BiImplantacaoService);
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.executarSql.mockResolvedValue({
      ok: true,
      mensagem: '3 linha(s).',
      colunas: [],
      linhas: LINHAS_ORACLE,
    });
    // Sem versão editada no Consultas BD → vale o SQL default embutido.
    consultas.porSlug.mockResolvedValue(null);
    consultas.salvar.mockResolvedValue(null);
  });

  describe('periodo', () => {
    it('usa as datas informadas quando são ISO válidas', () => {
      const p = service.periodo({
        dataIni: '2026-01-01',
        dataFim: '2026-03-31',
      });
      expect(p).toEqual({ inicio: '2026-01-01', fim: '2026-03-31' });
    });

    it('sem dataIni, recua 12 meses a partir do fim', () => {
      const p = service.periodo({ dataFim: '2026-07-29' });
      expect(p.inicio).toBe('2025-07-29');
      expect(p.fim).toBe('2026-07-29');
    });

    it('inverte quando o início vem depois do fim', () => {
      const p = service.periodo({
        dataIni: '2026-12-01',
        dataFim: '2026-01-01',
      });
      expect(p).toEqual({ inicio: '2026-01-01', fim: '2026-12-01' });
    });

    it('ignora data em formato inválido e cai no padrão', () => {
      const p = service.periodo({
        dataIni: '29/07/2026',
        dataFim: '2026-07-29',
      });
      expect(p.inicio).toBe('2025-07-29');
    });

    it('recuo de 12 meses prende no último dia quando o mês destino é mais curto', () => {
      const p = service.periodo({ dataFim: '2026-03-31' });
      expect(p.inicio).toBe('2025-03-31');
    });
  });

  describe('resumo', () => {
    it('avisa (sem quebrar) quando a conexão com o SICLA não está configurada', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.resumo({});
      expect(r.erro).toContain('não configurada');
      expect(r.linhas).toEqual([]);
      expect(r.totais.quantidade).toBe(0);
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });

    it('propaga a mensagem quando o SQL falha', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942: tabela ou view inexistente',
        colunas: [],
        linhas: [],
      });
      const r = await service.resumo({});
      expect(r.erro).toContain('ORA-00942');
      expect(r.linhas).toEqual([]);
    });

    it('normaliza as colunas do Oracle para o formato do frontend', async () => {
      const r = await service.resumo({});
      expect(r.linhas).toHaveLength(3);
      expect(r.linhas[0]).toMatchObject({
        codigo: 138935,
        fantasia: 'DEG / DALCERO',
        statusRns: '1-Não inciado',
        horasPrevistas: 10,
        horasRealizadas: 4,
        horasSaldo: 6,
        grupoEconomico: 'DEG / DALCERO',
      });
      // nulos viram string vazia, não "null"
      expect(r.linhas[0].dataPrevUso).toBe('');
    });

    it('totaliza as horas e calcula o % de utilização', async () => {
      const r = await service.resumo({});
      expect(r.totais.quantidade).toBe(3);
      expect(r.totais.horasPrevistas).toBe(40);
      expect(r.totais.horasRealizadas).toBe(34);
      expect(r.totais.horasSaldo).toBe(6);
      expect(r.totais.percentualUtilizacao).toBe(85);
    });

    // Regra vinda da medida Grafico_Horas_HTML do Power BI.
    it('soma as horas ADICIONAIS às cobradas e bonificadas, como o relatório original', async () => {
      const r = await service.resumo({});
      expect(r.linhas[0].horasCobradas).toBe(2); // 0 + 2 adicionais
      expect(r.linhas[0].horasBonificadas).toBe(13); // 10 + 3 adicionais
      expect(r.totais.horasCobradas).toBe(32); // (0+2) + (30+0) + 0
      expect(r.totais.horasBonificadas).toBe(13);
    });

    it('expõe o saldo CALCULADO (previstas - realizadas) ao lado do saldo do SICLA', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        // HORASALDO propositalmente divergente de previstas - realizadas
        linhas: [
          {
            ...LINHAS_ORACLE[0],
            HORASPREVISTAS: 10,
            HORASREALIZADAS: 4,
            HORASALDO: 99,
          },
        ],
      });
      const r = await service.resumo({});
      expect(r.totais.horasSaldo).toBe(99); // coluna do SICLA
      expect(r.totais.horasSaldoCalculado).toBe(6); // o que o BI mostra no card SALDO
    });

    it('saldo calculado fica negativo quando estoura as horas previstas', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        linhas: [
          { ...LINHAS_ORACLE[0], HORASPREVISTAS: 10, HORASREALIZADAS: 25 },
        ],
      });
      const r = await service.resumo({});
      expect(r.totais.horasSaldoCalculado).toBe(-15);
      expect(r.totais.percentualUtilizacao).toBe(250);
    });

    it('percentual fica null quando não há horas previstas', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        linhas: [LINHAS_ORACLE[2]],
      });
      const r = await service.resumo({});
      expect(r.totais.percentualUtilizacao).toBeNull();
    });

    it('lista as opções de filtro em ordem, a partir do período inteiro', async () => {
      const r = await service.resumo({});
      expect(r.filtros.status).toEqual(['1-Não inciado', '6-Concluída']);
      expect(r.filtros.tecnicos).toEqual(['Jolemar', 'Kailan']);
      expect(r.filtros.ativos).toEqual(['Não', 'Sim']);
      expect(r.filtros.tiposCliente).toEqual(['Cliente', 'Prospecto']);
    });

    it('filtra por status sem encolher a lista de opções disponíveis', async () => {
      const r = await service.resumo({ status: ['6-Concluída'] });
      expect(r.linhas.map((l) => l.codigo)).toEqual([138937, 138900]);
      // as opções continuam completas — senão o usuário fica preso na seleção
      expect(r.filtros.status).toEqual(['1-Não inciado', '6-Concluída']);
      expect(r.selecionados.status).toEqual(['6-Concluída']);
    });

    it('combina filtros (E lógico entre dimensões)', async () => {
      const r = await service.resumo({
        status: ['6-Concluída'],
        tecnico: ['Jolemar'],
      });
      expect(r.linhas.map((l) => l.codigo)).toEqual([138900]);
    });

    it('filtro vazio significa "todos"', async () => {
      const r = await service.resumo({ status: [], tecnico: [''] });
      expect(r.linhas).toHaveLength(3);
    });

    it('cascata: grupo econômico restringe as opções de RNS, status e consultor', async () => {
      const r = await service.resumo({ grupo: ['MANTAS BRASIL'] });
      expect(r.linhas.map((l) => l.codigo)).toEqual([138937]);
      expect(r.filtros.rns.map((o) => o.codigo)).toEqual(['138937']);
      expect(r.filtros.status).toEqual(['6-Concluída']);
      expect(r.filtros.tecnicos).toEqual(['Kailan']);
      // a própria dimensão continua completa
      expect(r.filtros.grupos).toEqual([
        'DEG / DALCERO',
        'JES-MAHI',
        'MANTAS BRASIL',
      ]);
    });

    it('filtra por RNS de implantação e rotula a opção com o cliente', async () => {
      const r = await service.resumo({ rns: ['138937'] });
      expect(r.linhas.map((l) => l.codigo)).toEqual([138937]);
      expect(r.filtros.rns[0]).toEqual({
        codigo: '138937',
        rotulo: '138937 — PLAQUES RS',
      });
      expect(r.selecionados.rns).toEqual(['138937']);
    });

    it('agrupa por status em ordem alfabética, somando as horas', async () => {
      const r = await service.resumo({});
      expect(r.porStatus).toEqual([
        {
          chave: '1-Não inciado',
          quantidade: 1,
          horasPrevistas: 10,
          horasRealizadas: 4,
          horasSaldo: 6,
        },
        {
          chave: '6-Concluída',
          quantidade: 2,
          horasPrevistas: 30,
          horasRealizadas: 30,
          horasSaldo: 0,
        },
      ]);
    });

    it('agrupa por técnico ordenando por horas realizadas (desc)', async () => {
      const r = await service.resumo({});
      expect(r.porTecnico.map((a) => a.chave)).toEqual(['Kailan', 'Jolemar']);
      expect(r.porTecnico[0].horasRealizadas).toBe(30);
    });

    it('manda o período como bind e respeita o teto de linhas', async () => {
      await service.resumo({ dataIni: '2026-01-01', dataFim: '2026-12-31' });
      const [, binds, , limite] = disponibilidade.executarSql.mock.calls[0];
      expect(binds).toEqual({ data_ini: '2026-01-01', data_fim: '2026-12-31' });
      expect(limite).toBe(5000);
    });
  });

  // ── Página "Extrato de Protocolo/Horas" ──────────────────────────────────────────────
  describe('extrato', () => {
    const LINHAS_EXTRATO = [
      {
        IMP_COD: 138935,
        IMP_CLIENTE: 3180,
        PROTOCOLO: 1435877,
        DATA: '2026-07-29',
        HORA: '10:35',
        LIS_SIGLA: 'FAT',
        LIS_TECNICODESCRICAO: 'Ramon',
        LIS_DESCRICAO: 'DEG / DALCERO RNI 138935',
        SISTEMADESCRICAO: 'Faturamento',
        DESCRICAO: '- PARTICIPANTES: Jose Augusto',
        DESCRICAO_TAMANHO: 1250, // maior que o trecho de 300 => truncada
        LISHORASUTILIZADAS: -0.55, // a view grava NEGATIVO
        SALDO_ACUMULADO: 1.45,
        FANTASIA: 'DEG / DALCERO',
        GRUPO_ECONOMICO: 'DEG / DALCERO',
        STATUS_RNS: '1-Não inciado',
        RNS_DESCRICAO: 'DEG - Adendo FAT e NFE',
      },
      {
        IMP_COD: 138900,
        IMP_CLIENTE: 982,
        PROTOCOLO: 1436074,
        DATA: '2026-07-28',
        HORA: '10:00',
        LIS_SIGLA: 'FIN',
        LIS_TECNICODESCRICAO: 'Liliana',
        LIS_DESCRICAO: 'COCOLANDIA DRM - USO OFICIAL',
        SISTEMADESCRICAO: 'Financeiro',
        DESCRICAO: 'Mariana informou que o CNPJ...',
        DESCRICAO_TAMANHO: 120, // menor que o trecho => completa
        LISHORASUTILIZADAS: -0.75,
        SALDO_ACUMULADO: 103.15,
        FANTASIA: 'COCOLANDIA / DRM',
        GRUPO_ECONOMICO: 'COCOLANDIA / DRM',
        STATUS_RNS: '6-Concluída',
        RNS_DESCRICAO: 'COCOLANDIA - uso oficial',
      },
    ];

    beforeEach(() => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '2 linha(s).',
        colunas: [],
        linhas: LINHAS_EXTRATO,
      });
    });

    // Decisão do usuário em 2026-07-29: TODA página do BI abre com os últimos 12 meses.
    it('usa a mesma janela padrão do resumo: últimos 12 meses', async () => {
      const r = await service.extrato({ dataFim: '2026-07-29' });
      expect(r.periodo.inicio).toBe('2025-07-29');
      expect(r.periodo.fim).toBe('2026-07-29');
    });

    it('janela padrão do extrato e do resumo são iguais', async () => {
      const e = await service.extrato({ dataFim: '2026-07-29' });
      const s = await service.resumo({ dataFim: '2026-07-29' });
      expect(e.periodo).toEqual(s.periodo);
    });

    it('mostra as horas em valor ABSOLUTO (a view grava consumo negativo)', async () => {
      const r = await service.extrato({});
      expect(r.linhas[0].horasUtilizadas).toBe(0.55);
      expect(r.linhas[1].horasUtilizadas).toBe(0.75);
      expect(r.totais.horasUtilizadas).toBe(1.3);
    });

    it('marca a descrição como truncada quando o texto real passa do trecho trazido', async () => {
      const r = await service.extrato({});
      expect(r.linhas[0].descricaoTruncada).toBe(true);
      expect(r.linhas[0].descricaoTamanho).toBe(1250);
      expect(r.linhas[1].descricaoTruncada).toBe(false);
    });

    it('saldo atual é o do lançamento mais recente (as linhas vêm em ordem decrescente)', async () => {
      const r = await service.extrato({});
      expect(r.totais.saldoAtual).toBe(1.45);
      expect(r.totais.lancamentos).toBe(2);
    });

    it('saldo atual é null quando o recorte não devolve nada', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '0',
        colunas: [],
        linhas: [],
      });
      const r = await service.extrato({});
      expect(r.totais.saldoAtual).toBeNull();
    });

    it('lista os filtros e aplica a seleção', async () => {
      const r = await service.extrato({});
      expect(r.filtros.siglas).toEqual(['FAT', 'FIN']);
      expect(r.filtros.tecnicos).toEqual(['Liliana', 'Ramon']);
      expect(r.linhas).toHaveLength(2);
    });

    // Pedido do usuário em 2026-07-29: escolher um filtro deve restringir as opções dos
    // demais (cascata), mas NUNCA as da própria dimensão — senão não dá para trocar a
    // escolha nem marcar um segundo valor.
    it('filtrar por sigla restringe as opções das OUTRAS dimensões', async () => {
      const r = await service.extrato({ sigla: ['FAT'] });
      expect(r.linhas.map((l) => l.protocolo)).toEqual([1435877]);
      expect(r.filtros.tecnicos).toEqual(['Ramon']); // Liliana só aparece em FIN
      expect(r.filtros.clientes).toEqual(['DEG / DALCERO']);
      expect(r.filtros.rns.map((o) => o.codigo)).toEqual(['138935']);
    });

    it('a própria dimensão mantém todas as opções', async () => {
      const r = await service.extrato({ sigla: ['FAT'] });
      expect(r.filtros.siglas).toEqual(['FAT', 'FIN']);
      expect(r.selecionados.siglas).toEqual(['FAT']);
    });

    it('filtrar por grupo econômico restringe RNS, status, consultor, cliente e módulo', async () => {
      const r = await service.extrato({ grupo: ['COCOLANDIA / DRM'] });
      expect(r.filtros.rns.map((o) => o.codigo)).toEqual(['138900']);
      expect(r.filtros.status).toEqual(['6-Concluída']);
      expect(r.filtros.tecnicos).toEqual(['Liliana']);
      expect(r.filtros.clientes).toEqual(['COCOLANDIA / DRM']);
      expect(r.filtros.siglas).toEqual(['FIN']);
      // e o próprio grupo continua com as duas opções
      expect(r.filtros.grupos).toEqual(['COCOLANDIA / DRM', 'DEG / DALCERO']);
    });

    // Os 4 filtros padrão das telas do BI: grupo econômico, RNS, status da RNS e técnico.
    it('traz o status da RNS pelo join com o RESUMO', async () => {
      const r = await service.extrato({});
      expect(r.linhas[0].statusRns).toBe('1-Não inciado');
      expect(r.filtros.status).toEqual(['1-Não inciado', '6-Concluída']);
    });

    it('filtra por status da RNS de implantação', async () => {
      const r = await service.extrato({ status: ['6-Concluída'] });
      expect(r.linhas.map((l) => l.rns)).toEqual([138900]);
    });

    it('filtra por RNS de implantação', async () => {
      const r = await service.extrato({ rns: ['138935'] });
      expect(r.linhas.map((l) => l.rns)).toEqual([138935]);
    });

    it('rotula a RNS com o cliente e ordena da mais recente para a mais antiga', async () => {
      const r = await service.extrato({});
      expect(r.filtros.rns).toEqual([
        { codigo: '138935', rotulo: '138935 — DEG / DALCERO' },
        { codigo: '138900', rotulo: '138900 — COCOLANDIA / DRM' },
      ]);
    });

    it('filtra por grupo econômico e por técnico', async () => {
      expect(
        (await service.extrato({ grupo: ['COCOLANDIA / DRM'] })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual([138900]);
      expect(
        (await service.extrato({ tecnico: ['Ramon'] })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual([138935]);
    });

    it('avisa quando bate no teto de linhas', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: 'muitas',
        colunas: [],
        linhas: Array.from({ length: 10000 }, () => LINHAS_EXTRATO[0]),
      });
      const r = await service.extrato({});
      expect(r.truncado).toBe(true);
    });

    it('propaga erro do banco sem quebrar', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-01652',
        colunas: [],
        linhas: [],
      });
      const r = await service.extrato({});
      expect(r.erro).toContain('ORA-01652');
      expect(r.linhas).toEqual([]);
    });
  });

  // ── Página "RNS" (vinculadas às implantações) ────────────────────────────────────────
  describe('rnsVinculadas', () => {
    const LINHAS_RNS = [
      {
        CODIGO: 56461001,
        PEDIDO: 564610,
        ITEM: 1,
        DATA_CRIACAO: '2026-07-28',
        STATUSDES: '1-Redigida',
        SIGLA: 'CNV',
        SISDESCRI: 'Conversão',
        VISAOGERAL: '[BON] Conversão de histórico de vendas',
        VERSOESGERACAO: null,
        VALIDADOCLI: 0,
        TIPODES: '6-Conversão',
        RESNOME: 'Kailan',
        ANANOME: 'Ana',
        CLIENTE: 3729,
        FANTASIA: 'PLAQUES RS',
        IMP_COD: 138937,
        IMP_DESCRICAO: 'PLAQUES RS - Controladoria',
        STATUS_IMPLANTACAO: '1-Não inciado',
        TECNICO: 'Kailan',
        GRUPO_ECONOMICO: 'MANTAS BRASIL',
      },
      {
        CODIGO: 56460001,
        PEDIDO: 564600,
        ITEM: 2,
        DATA_CRIACAO: '2026-07-20',
        STATUSDES: '10-Entregue',
        SIGLA: 'FAT',
        SISDESCRI: 'Faturamento',
        VISAOGERAL: 'Ajuste no faturamento',
        VERSOESGERACAO: '2.8.1',
        VALIDADOCLI: 1,
        TIPODES: '5-Implementação',
        RESNOME: 'Eder',
        ANANOME: 'Bia',
        CLIENTE: 982,
        FANTASIA: 'JES-MAHI',
        IMP_COD: 138900,
        IMP_DESCRICAO: 'JES-MAHI - PWE',
        STATUS_IMPLANTACAO: '6-Concluída',
        TECNICO: 'Jolemar',
        GRUPO_ECONOMICO: 'JES-MAHI',
      },
    ];

    beforeEach(() => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '2 linha(s).',
        colunas: [],
        linhas: LINHAS_RNS,
      });
    });

    it('monta o número da RNS no formato PEDIDO-ITEM do SICLA', async () => {
      const r = await service.rnsVinculadas({});
      expect(r.linhas[0].rns).toBe('564610-1');
      expect(r.linhas[1].rns).toBe('564600-2');
    });

    it('converte VALIDADOCLI (0/1) em booleano e totaliza', async () => {
      const r = await service.rnsVinculadas({});
      expect(r.linhas[0].validadaCliente).toBe(false);
      expect(r.linhas[1].validadaCliente).toBe(true);
      expect(r.totais).toEqual({
        quantidade: 2,
        validadas: 1,
        naoValidadas: 1,
        implantacoes: 2,
      });
    });

    it('filtra por validação do cliente (tri-estado)', async () => {
      expect(
        (await service.rnsVinculadas({ validada: 'sim' })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual(['564600-2']);
      expect(
        (await service.rnsVinculadas({ validada: 'nao' })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual(['564610-1']);
      // vazio = todas
      expect(
        (await service.rnsVinculadas({ validada: '' })).linhas,
      ).toHaveLength(2);
      expect((await service.rnsVinculadas({})).linhas).toHaveLength(2);
    });

    it('aplica os filtros padrão (grupo, RNS de implantação, status e consultor)', async () => {
      expect(
        (await service.rnsVinculadas({ rns: ['138937'] })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual(['564610-1']);
      expect(
        (await service.rnsVinculadas({ tecnico: ['Jolemar'] })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual(['564600-2']);
      expect(
        (await service.rnsVinculadas({ grupo: ['JES-MAHI'] })).linhas.map(
          (l) => l.rns,
        ),
      ).toEqual(['564600-2']);
      expect(
        (
          await service.rnsVinculadas({ statusImplantacao: ['6-Concluída'] })
        ).linhas.map((l) => l.rns),
      ).toEqual(['564600-2']);
    });

    it('filtra por status da RNS, sigla e tipo', async () => {
      expect(
        (await service.rnsVinculadas({ status: ['1-Redigida'] })).linhas,
      ).toHaveLength(1);
      expect(
        (await service.rnsVinculadas({ sigla: ['FAT'] })).linhas,
      ).toHaveLength(1);
      expect(
        (await service.rnsVinculadas({ tipo: ['6-Conversão'] })).linhas,
      ).toHaveLength(1);
    });

    it('conta por status e por sigla, do maior para o menor', async () => {
      const r = await service.rnsVinculadas({});
      expect(r.porStatus).toEqual([
        { chave: '1-Redigida', quantidade: 1 },
        { chave: '10-Entregue', quantidade: 1 },
      ]);
      expect(r.porSigla.map((c) => c.chave).sort()).toEqual(['CNV', 'FAT']);
    });

    it('rotula a RNS de implantação com o cliente', async () => {
      const r = await service.rnsVinculadas({});
      expect(r.filtros.rns).toContainEqual({
        codigo: '138937',
        rotulo: '138937 — PLAQUES RS',
      });
    });

    it('usa a janela padrão de 12 meses', async () => {
      const r = await service.rnsVinculadas({ dataFim: '2026-07-29' });
      expect(r.periodo.inicio).toBe('2025-07-29');
    });

    it('propaga erro do banco sem quebrar', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      const r = await service.rnsVinculadas({});
      expect(r.erro).toContain('ORA-00942');
      expect(r.linhas).toEqual([]);
      expect(r.totais.quantidade).toBe(0);
    });

    it('avisa quando o SICLA não está configurado', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.rnsVinculadas({});
      expect(r.erro).toContain('não configurada');
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });
  });

  // ── Página "Agendas" (calendário mensal) ─────────────────────────────────────────────
  describe('agendas', () => {
    function agenda(over: Record<string, unknown> = {}) {
      return {
        CODIGO: 1,
        RNSIMP: 138571,
        DIA: '2026-07-06',
        HORAINI: '09:00:00',
        HORAFIM: '11:30:00',
        STATUSDES: '3-Agendada',
        ESPECIE: 92,
        ESPECIEDES: 'Atendimento Externo NÃO COBRADO',
        PARTICIPANTES: 'Liliana,Medeiros',
        RESPONSAVELDES: 'Paim',
        CLIENTE: 3627,
        CLIENTEFAN: 'RAMADA',
        ASSUNTO: 'Treinamento',
        HORASDURACAO: 2.5,
        VISITA: null,
        OBSERVACAO: 'obs',
        STATUS_IMPLANTACAO: '3-Em Treinamento',
        TECNICO: 'Paim',
        RNS_DESCRICAO: 'RAMADA - implantação',
        GRUPO_ECONOMICO: 'RAMADA',
        ...over,
      };
    }

    beforeEach(() => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [agenda()],
      });
    });

    // As espécies vêm do FILTRO gravado no visual do calendário dentro do .pbix
    // (`ESPECIE In ('92','84')`) — e NÃO do SWITCH da medida, que rotula um código a mais
    // (90 = Produção Interna Normal Apontada) que o visual nunca exibiu.
    it('o SQL restringe às espécies 84 e 92 do calendário', () => {
      expect(SQL_AGENDAS).toContain('a.ESPECIE IN (84, 92)');
    });

    it('não inclui a espécie 90 (produção interna, fora do calendário)', () => {
      expect(ESPECIES_CALENDARIO).toEqual([84, 92]);
      expect(ESPECIES_CALENDARIO).not.toContain(90);
    });

    it('usa o mês corrente quando não informado e monta todos os dias', async () => {
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.mes).toBe('2026-07');
      expect(r.dias).toHaveLength(31);
      expect(r.dias[0].dia).toBe('2026-07-01');
      // 2026-07-01 é uma quarta-feira
      expect(r.dias[0].diaSemana).toBe(3);
    });

    it('fevereiro tem 28 dias (e o SQL recebe o mês seguinte como fronteira)', async () => {
      const r = await service.agendas({ mes: '2026-02' });
      expect(r.dias).toHaveLength(28);
      const [, binds] = disponibilidade.executarSql.mock.calls[0];
      expect(binds).toEqual({ mes_ini: '2026-02-01', mes_fim: '2026-03-01' });
    });

    it('dezembro vira para janeiro do ano seguinte', async () => {
      await service.agendas({ mes: '2026-12' });
      const [, binds] = disponibilidade.executarSql.mock.calls[0];
      expect(binds).toEqual({ mes_ini: '2026-12-01', mes_fim: '2027-01-01' });
    });

    it('mês inválido cai no mês atual', async () => {
      const r = await service.agendas({ mes: 'julho' });
      expect(r.mes).toMatch(/^\d{4}-\d{2}$/);
    });

    // Regra do DAX: visita apontada sobrepõe o STATUSDES.
    it('VISITA preenchida força o status para Realizada', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [agenda({ STATUSDES: '8-Postergada', VISITA: 987 })],
      });
      const r = await service.agendas({ mes: '2026-07' });
      const a = r.dias.flatMap((d) => d.agendas)[0];
      expect(a.status).toBe('6-Realizada');
      expect(a.statusOriginal).toBe('8-Postergada'); // o original fica visível
    });

    it('sem visita, o status original é preservado', async () => {
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.dias.flatMap((d) => d.agendas)[0].status).toBe('3-Agendada');
    });

    it('divide PARTICIPANTES por vírgula (a view guarda todos numa coluna só)', async () => {
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.dias.flatMap((d) => d.agendas)[0].participantes).toEqual([
        'Liliana',
        'Medeiros',
      ]);
    });

    it('classifica o turno pelo horário de início', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '3',
        colunas: [],
        linhas: [
          agenda({ CODIGO: 1, HORAINI: '08:00:00' }),
          agenda({ CODIGO: 2, HORAINI: '14:00:00' }),
          agenda({ CODIGO: 3, HORAINI: '19:00:00' }),
        ],
      });
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.dias.flatMap((d) => d.agendas).map((a) => a.turno)).toEqual([
        'Manhã',
        'Tarde',
        'Noite',
      ]);
    });

    describe('prioridade do dia (regra do DAX)', () => {
      it('havendo agendada, o dia mostra SÓ as agendadas', async () => {
        disponibilidade.executarSql.mockResolvedValue({
          ok: true,
          mensagem: '3',
          colunas: [],
          linhas: [
            agenda({ CODIGO: 1, STATUSDES: '3-Agendada' }),
            agenda({ CODIGO: 2, STATUSDES: '9-Cancelada' }),
            agenda({ CODIGO: 3, STATUSDES: '8-Postergada' }),
          ],
        });
        const r = await service.agendas({ mes: '2026-07' });
        const dia = r.dias.find((d) => d.dia === '2026-07-06')!;
        expect(dia.agendas.map((a) => a.codigo)).toEqual([1]);
        // o dia guarda quantas foram escondidas, para a tela poder avisar
        expect(dia.totalNoDia).toBe(3);
      });

      it('sem agendada mas com solicitada, oculta apenas as canceladas', async () => {
        disponibilidade.executarSql.mockResolvedValue({
          ok: true,
          mensagem: '3',
          colunas: [],
          linhas: [
            agenda({ CODIGO: 1, STATUSDES: '1-Solicitada' }),
            agenda({ CODIGO: 2, STATUSDES: '9-Cancelada' }),
            agenda({ CODIGO: 3, STATUSDES: '8-Postergada' }),
          ],
        });
        const r = await service.agendas({ mes: '2026-07' });
        const dia = r.dias.find((d) => d.dia === '2026-07-06')!;
        expect(dia.agendas.map((a) => a.codigo).sort()).toEqual([1, 3]);
      });

      it('sem agendada nem solicitada, mostra tudo (inclusive canceladas)', async () => {
        disponibilidade.executarSql.mockResolvedValue({
          ok: true,
          mensagem: '2',
          colunas: [],
          linhas: [
            agenda({ CODIGO: 1, STATUSDES: '9-Cancelada' }),
            agenda({ CODIGO: 2, STATUSDES: '6-Realizada' }),
          ],
        });
        const r = await service.agendas({ mes: '2026-07' });
        const dia = r.dias.find((d) => d.dia === '2026-07-06')!;
        expect(dia.agendas).toHaveLength(2);
      });
    });

    it('ordena o dia por turno e horário', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '3',
        colunas: [],
        linhas: [
          agenda({ CODIGO: 1, HORAINI: '15:00:00', STATUSDES: '6-Realizada' }),
          agenda({ CODIGO: 2, HORAINI: '08:30:00', STATUSDES: '6-Realizada' }),
          agenda({ CODIGO: 3, HORAINI: '08:00:00', STATUSDES: '6-Realizada' }),
        ],
      });
      const r = await service.agendas({ mes: '2026-07' });
      const dia = r.dias.find((d) => d.dia === '2026-07-06')!;
      expect(dia.agendas.map((a) => a.codigo)).toEqual([3, 2, 1]);
    });

    it('filtra por participante quando UM dos nomes casa', async () => {
      const r = await service.agendas({
        mes: '2026-07',
        tecnico: ['Medeiros'],
      });
      expect(r.dias.flatMap((d) => d.agendas)).toHaveLength(1);
      const vazio = await service.agendas({
        mes: '2026-07',
        tecnico: ['Ninguém'],
      });
      expect(vazio.dias.flatMap((d) => d.agendas)).toHaveLength(0);
    });

    it('lista os participantes individualmente no filtro', async () => {
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.filtros.tecnicos).toEqual(['Liliana', 'Medeiros']);
    });

    it('resume por status com percentual e cor pastel do relatório', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '4',
        colunas: [],
        linhas: [
          agenda({ CODIGO: 1, DIA: '2026-07-06', STATUSDES: '6-Realizada' }),
          agenda({ CODIGO: 2, DIA: '2026-07-07', STATUSDES: '6-Realizada' }),
          agenda({ CODIGO: 3, DIA: '2026-07-08', STATUSDES: '6-Realizada' }),
          agenda({ CODIGO: 4, DIA: '2026-07-09', STATUSDES: '9-Cancelada' }),
        ],
      });
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.totalAgendas).toBe(4);
      expect(r.resumo).toEqual([
        {
          status: '6-Realizada',
          quantidade: 3,
          percentual: 75,
          cor: '#FFF5E0',
        },
        {
          status: '9-Cancelada',
          quantidade: 1,
          percentual: 25,
          cor: '#FFE0E0',
        },
      ]);
    });

    it('o resumo conta o VISÍVEL, não o bruto (senão diverge da grade)', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '2',
        colunas: [],
        linhas: [
          agenda({ CODIGO: 1, STATUSDES: '3-Agendada' }),
          agenda({ CODIGO: 2, STATUSDES: '9-Cancelada' }), // escondida pela prioridade
        ],
      });
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.totalAgendas).toBe(1);
      expect(r.resumo.map((x) => x.status)).toEqual(['3-Agendada']);
    });

    it('propaga erro do banco e avisa se o SICLA não está configurado', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942',
        colunas: [],
        linhas: [],
      });
      expect((await service.agendas({ mes: '2026-07' })).erro).toContain(
        'ORA-00942',
      );

      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.agendas({ mes: '2026-07' });
      expect(r.erro).toContain('não configurada');
      expect(r.dias).toEqual([]);
    });
  });

  describe('descricaoCompleta', () => {
    it('busca pelo par protocolo + data/hora', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1',
        colunas: [],
        linhas: [{ DESCRICAO: 'texto completo', DESCRICAO_TAMANHO: 14 }],
      });
      const r = await service.descricaoCompleta(1435877, '2026-07-29 10:35');
      expect(r.descricao).toBe('texto completo');
      expect(r.erro).toBeNull();
      const [, binds] = disponibilidade.executarSql.mock.calls[0];
      expect(binds).toEqual({
        protocolo: 1435877,
        datahora: '2026-07-29 10:35',
      });
    });

    it('avisa quando o lançamento não existe', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '0',
        colunas: [],
        linhas: [],
      });
      const r = await service.descricaoCompleta(1, '2026-01-01 00:00');
      expect(r.erro).toContain('não encontrado');
    });

    it('não vai ao banco se a conexão não está configurada', async () => {
      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.descricaoCompleta(1, '2026-01-01 00:00');
      expect(r.erro).toContain('não configurada');
      expect(disponibilidade.executarSql).not.toHaveBeenCalled();
    });
  });

  describe('visitasPortal (painel abaixo do CONTROLE DE HORAS)', () => {
    const VISITA_ORACLE = {
      EMPRESA: 'DEG / DALCERO',
      CODIGO_CLIENTE: 3180,
      CONTATO: 'Iloni',
      CONSULTOR: 'Remeling',
      PROTOCOLO: 4821,
      DATA: '2026-08-13',
      HORARIO: '08:30:00',
      TURNO: 'MANHÃ',
      APROVADO: 'Sim',
    };

    beforeEach(() => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        linhas: [VISITA_ORACLE],
      });
    });

    it('semeia o SQL default no boot quando ainda não existe (sem sobrescrever edição)', async () => {
      const nodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        await service.onModuleInit();
        expect(consultas.salvar).toHaveBeenCalledWith(
          SLUG_CONSULTA_VISITAS_PORTAL,
          {
            nome: NOME_CONSULTA_VISITAS_PORTAL,
            sql: SQL_VISITAS_PORTAL_PADRAO,
            ordem: expect.any(Number),
            mostrarGrafico: false,
          },
        );

        // Já existe (editada ou não): não encosta.
        consultas.salvar.mockClear();
        consultas.porSlug.mockResolvedValue({ sql: 'SELECT 1 FROM dual' });
        await service.onModuleInit();
        expect(consultas.salvar).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = nodeEnv;
      }
    });

    it('usa o SQL default (com os binds de período) quando não há versão editada', async () => {
      const r = await service.visitasPortal({
        dataIni: '2026-08-01',
        dataFim: '2026-08-31',
      });
      expect(r.erro).toBeNull();
      const [sql, binds] = disponibilidade.executarSql.mock.calls[0];
      expect(sql).toBe(SQL_VISITAS_PORTAL_PADRAO);
      expect(binds).toEqual({
        data_ini: '2026-08-01',
        data_fim: '2026-08-31',
      });
    });

    it('usa a versão EDITADA do Consultas BD, só com os binds que ela referencia', async () => {
      consultas.porSlug.mockResolvedValue({
        sql: 'SELECT 1 AS PROTOCOLO FROM dual',
      });
      await service.visitasPortal({
        dataIni: '2026-08-01',
        dataFim: '2026-08-31',
      });
      // bind sobrando derrubaria o Oracle com ORA-01036
      const [sql, binds] = disponibilidade.executarSql.mock.calls[0];
      expect(sql).toBe('SELECT 1 AS PROTOCOLO FROM dual');
      expect(binds).toEqual({});
    });

    it('normaliza os aliases da consulta para o formato do frontend', async () => {
      const r = await service.visitasPortal({});
      expect(r.total).toBe(1);
      expect(r.linhas[0]).toEqual({
        empresa: 'DEG / DALCERO',
        cliente: 3180,
        contato: 'Iloni',
        consultor: 'Remeling',
        protocolo: 4821,
        data: '2026-08-13',
        horario: '08:30:00',
        turno: 'MANHÃ',
        aprovado: 'Sim',
      });
    });

    it('valores nulos viram texto vazio / cliente e protocolo nulos', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: true,
        mensagem: '1 linha(s).',
        colunas: [],
        linhas: [
          {
            EMPRESA: null,
            CODIGO_CLIENTE: null,
            CONTATO: null,
            CONSULTOR: null,
            PROTOCOLO: null,
            DATA: null,
            HORARIO: null,
            TURNO: null,
            APROVADO: 'Não',
          },
        ],
      });
      const r = await service.visitasPortal({});
      expect(r.linhas[0]).toEqual({
        empresa: '',
        cliente: null,
        contato: '',
        consultor: '',
        protocolo: null,
        data: '',
        horario: '',
        turno: '',
        aprovado: 'Não',
      });
    });

    it('propaga erro do banco e avisa se a conexão não está configurada', async () => {
      disponibilidade.executarSql.mockResolvedValue({
        ok: false,
        mensagem: 'ORA-00942: tabela ou view inexistente',
        colunas: [],
        linhas: [],
      });
      expect((await service.visitasPortal({})).erro).toContain('ORA-00942');

      disponibilidade.configurado.mockReturnValue(false);
      const r = await service.visitasPortal({});
      expect(r.erro).toContain('não configurada');
      expect(r.linhas).toEqual([]);
    });
  });
});
