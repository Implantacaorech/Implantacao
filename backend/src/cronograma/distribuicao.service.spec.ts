import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DistribuicaoService } from './distribuicao.service';
import { CronogramaService } from './cronograma.service';
import { DesignacoesService } from './designacoes.service';
import { Projeto } from '../database/entities/projeto.entity';
import { UsersService } from '../users/users.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';

// Só a disponibilidade EXTERNA (SICLA/Oracle) é o foco destes testes — o resto do
// algoritmo (ordem de treinamento, V1<V2, piso, Go-live...) já é coberto pela suíte e2e
// real do Agendador (test/cronograma.e2e-spec.ts). Aqui, um cenário mínimo (1-2 módulos,
// sem período bloqueado nem dias excluídos) isola só o comportamento novo:
// bloqueado_ext/modo conjunta-individual.
describe('DistribuicaoService — disponibilidade externa (SICLA/Oracle)', () => {
  let service: DistribuicaoService;

  const atividadeFat = {
    id: 1,
    modulo: 'FAT',
    seq: 1,
    status: '',
    data: '',
    turno: '',
    tecnico: '',
  };
  const atividadeEst = {
    id: 2,
    modulo: 'EST',
    seq: 1,
    status: '',
    data: '',
    turno: '',
    tecnico: '',
  };

  const cronograma = {
    listarAtividades: jest.fn(),
    visitas: jest.fn(),
    config: jest.fn(),
    periodosBloqueados: jest.fn().mockResolvedValue([]),
    alocar: jest.fn().mockResolvedValue(null),
  };
  const designacoesService = { doProjeto: jest.fn() };
  const projetos = { findOne: jest.fn().mockResolvedValue({ dataUsoOficial: '' }) };
  const users = { codigosSiclaPorNome: jest.fn() };
  const disponibilidade = { configurado: jest.fn(), ocupacaoPorSlotCache: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    cronograma.periodosBloqueados.mockResolvedValue([]);
    cronograma.alocar.mockResolvedValue(null);
    projetos.findOne.mockResolvedValue({ dataUsoOficial: '' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistribuicaoService,
        { provide: CronogramaService, useValue: cronograma },
        { provide: DesignacoesService, useValue: designacoesService },
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: UsersService, useValue: users },
        { provide: DisponibilidadeService, useValue: disponibilidade },
      ],
    }).compile();
    service = module.get(DistribuicaoService);
  });

  function configurarCenarioUmModulo(modo: 'conjunta' | 'individual' = 'individual') {
    cronograma.listarAtividades.mockResolvedValue([atividadeFat]);
    cronograma.visitas.mockResolvedValue([
      { modulo: 'FAT', seq: 1, atividades: [atividadeFat] },
    ]);
    cronograma.config.mockResolvedValue({
      modoDisponibilidade: modo,
      dataInicio: '2026-08-03', // segunda-feira
      diasTurnosExcluidos: '',
      analistaPadrao: '',
    });
    designacoesService.doProjeto.mockResolvedValue([
      { modulo: 'FAT', consultor: 'Ana', ordem: 1, naoDistribuir: false },
    ]);
  }

  it('sem disponibilidade configurada, não bloqueia por SICLA (comportamento anterior preservado)', async () => {
    configurarCenarioUmModulo();
    users.codigosSiclaPorNome.mockResolvedValue({ ana: '007' });
    disponibilidade.configurado.mockReturnValue(false);

    await service.distribuirAutomatico(1);

    expect(disponibilidade.ocupacaoPorSlotCache).not.toHaveBeenCalled();
    expect(cronograma.alocar).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'manha' }),
    );
  });

  it('técnico sem código SICLA cadastrado não consulta a disponibilidade externa', async () => {
    configurarCenarioUmModulo();
    users.codigosSiclaPorNome.mockResolvedValue({}); // ninguém tem código
    disponibilidade.configurado.mockReturnValue(true);

    await service.distribuirAutomatico(1);

    expect(disponibilidade.ocupacaoPorSlotCache).not.toHaveBeenCalled();
  });

  it('técnico ocupado no SICLA na manhã pula para a tarde do mesmo dia', async () => {
    configurarCenarioUmModulo();
    users.codigosSiclaPorNome.mockResolvedValue({ ana: '007' });
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.ocupacaoPorSlotCache.mockResolvedValue({
      '007|2026-08-03|manha': true,
    });

    await service.distribuirAutomatico(1);

    expect(cronograma.alocar).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'tarde' }),
    );
  });

  it('modo individual: só bloqueia a agenda do próprio técnico da visita', async () => {
    cronograma.listarAtividades.mockResolvedValue([atividadeFat, atividadeEst]);
    cronograma.visitas.mockResolvedValue([
      { modulo: 'FAT', seq: 1, atividades: [atividadeFat] },
      { modulo: 'EST', seq: 1, atividades: [atividadeEst] },
    ]);
    cronograma.config.mockResolvedValue({
      modoDisponibilidade: 'individual',
      dataInicio: '2026-08-03',
      diasTurnosExcluidos: '',
      analistaPadrao: '',
    });
    designacoesService.doProjeto.mockResolvedValue([
      { modulo: 'FAT', consultor: 'Ana', ordem: 1, naoDistribuir: false },
      { modulo: 'EST', consultor: 'Beto', ordem: 2, naoDistribuir: false },
    ]);
    users.codigosSiclaPorNome.mockResolvedValue({ ana: '007', beto: '008' });
    disponibilidade.configurado.mockReturnValue(true);
    // Ana (007) ocupada na manhã de 03/08 — Beto (008) não é afetado no modo individual.
    disponibilidade.ocupacaoPorSlotCache.mockResolvedValue({
      '007|2026-08-03|manha': true,
    });

    await service.distribuirAutomatico(1);

    expect(cronograma.alocar).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'tarde' }),
    ); // Ana pulou pra tarde
    expect(cronograma.alocar).toHaveBeenCalledWith(
      2,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'manha' }),
    ); // Beto ficou na manhã (não afetado)
  });

  it('modo conjunta: QUALQUER técnico ocupado no SICLA bloqueia o slot para TODOS', async () => {
    cronograma.listarAtividades.mockResolvedValue([atividadeFat, atividadeEst]);
    cronograma.visitas.mockResolvedValue([
      { modulo: 'FAT', seq: 1, atividades: [atividadeFat] },
      { modulo: 'EST', seq: 1, atividades: [atividadeEst] },
    ]);
    cronograma.config.mockResolvedValue({
      modoDisponibilidade: 'conjunta',
      dataInicio: '2026-08-03',
      diasTurnosExcluidos: '',
      analistaPadrao: '',
    });
    designacoesService.doProjeto.mockResolvedValue([
      { modulo: 'FAT', consultor: 'Ana', ordem: 1, naoDistribuir: false },
      { modulo: 'EST', consultor: 'Beto', ordem: 2, naoDistribuir: false },
    ]);
    users.codigosSiclaPorNome.mockResolvedValue({ ana: '007', beto: '008' });
    disponibilidade.configurado.mockReturnValue(true);
    // só a Ana (007) está ocupada na manhã de 03/08 — mas em modo conjunta isso bloqueia
    // o grupo inteiro, então Beto também não pode ficar na manhã de 03/08.
    disponibilidade.ocupacaoPorSlotCache.mockResolvedValue({
      '007|2026-08-03|manha': true,
    });

    await service.distribuirAutomatico(1);

    // Ana (FAT) é processada primeiro (ordem=1): manhã de 03/08 bloqueada pelo SICLA ->
    // vai para a tarde de 03/08.
    expect(cronograma.alocar).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'tarde' }),
    );
    // Beto (EST): a manhã de 03/08 já está bloqueada pelo SICLA (bloqueadoExt, em modo
    // conjunta vale pra qualquer técnico do projeto); a TARDE de 03/08 agora também está
    // ocupada — não pelo SICLA, mas pela Ana já alocada NESTE cronograma (ocupadoConjunta,
    // regra pré-existente do modo conjunta: qualquer compromisso do grupo bloqueia o slot
    // pra todos). Sem nenhum turno livre em 03/08, Beto cai no próximo dia útil.
    expect(cronograma.alocar).toHaveBeenCalledWith(
      2,
      1,
      expect.objectContaining({ data: '2026-08-04', turno: 'manha' }),
    );
  });

  it('falha ao consultar a disponibilidade externa não derruba a distribuição (fail-open)', async () => {
    configurarCenarioUmModulo();
    users.codigosSiclaPorNome.mockResolvedValue({ ana: '007' });
    disponibilidade.configurado.mockReturnValue(true);
    disponibilidade.ocupacaoPorSlotCache.mockRejectedValue(new Error('Oracle indisponível'));

    const r = await service.distribuirAutomatico(1);

    expect(r.ok).toBe(true);
    expect(cronograma.alocar).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ data: '2026-08-03', turno: 'manha' }),
    );
  });
});
