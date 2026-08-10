import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CronogramaService } from './cronograma.service';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { SlotCronograma } from '../database/entities/slot-cronograma.entity';
import { CronogramaConfig } from '../database/entities/cronograma-config.entity';
import { CronogramaPeriodoBloqueado } from '../database/entities/cronograma-periodo-bloqueado.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ChecklistModeloService } from '../catalogos/checklist-modelo.service';
import { UsersService } from '../users/users.service';
import { DisponibilidadeService } from '../disponibilidade/disponibilidade.service';
import { DesignacoesService } from './designacoes.service';

/** A semeadura das atividades é o que enche a Agenda de Visitas: sem ela a tela abre com
 * "Visitas a alocar: 0" e nenhum módulo na lista, sem erro nenhum na API. */
describe('CronogramaService — semeadura das atividades', () => {
  let service: CronogramaService;
  const atividades = { count: jest.fn(), create: jest.fn(), save: jest.fn() };
  const projetos = { findOne: jest.fn() };
  const checklist = { listarPorModulos: jest.fn() };
  const repoVazio = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    atividades.count.mockResolvedValue(0);
    atividades.create.mockImplementation((x: unknown) => x);
    atividades.save.mockImplementation((x: unknown) => Promise.resolve(x));
    checklist.listarPorModulos.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronogramaService,
        {
          provide: getRepositoryToken(AtividadeCronograma),
          useValue: atividades,
        },
        { provide: getRepositoryToken(SlotCronograma), useValue: repoVazio },
        { provide: getRepositoryToken(CronogramaConfig), useValue: repoVazio },
        {
          provide: getRepositoryToken(CronogramaPeriodoBloqueado),
          useValue: repoVazio,
        },
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: ChecklistModeloService, useValue: checklist },
        { provide: UsersService, useValue: {} },
        { provide: DisponibilidadeService, useValue: {} },
        { provide: DesignacoesService, useValue: {} },
      ],
    }).compile();
    service = module.get(CronogramaService);
  });

  it('traduz os CÓDIGOS do SICLA em SIGLAS antes de consultar o catálogo', async () => {
    // O caso real: desde que o passo 1 virou consulta ao SICLA, `modulos` guarda códigos
    // numéricos. Consultar o catálogo com "8, 7" casa zero linhas — a Agenda abria vazia.
    projetos.findOne.mockResolvedValue({
      id: 1,
      modulos: '8, 7',
      modulosDetalhe: JSON.stringify([
        { codigo: '8', descricao: 'COM - Sist.Controle de Compras' },
        { codigo: '7', descricao: 'EST - Sist.Controle de Estoques' },
      ]),
    });

    await service.garantirSeed(1);

    expect(checklist.listarPorModulos).toHaveBeenCalledWith(['COM', 'EST']);
  });

  it('projeto antigo, com as siglas digitadas à mão, continua funcionando', async () => {
    projetos.findOne.mockResolvedValue({
      id: 2,
      modulos: 'FAT, CTB',
      modulosDetalhe: null,
    });

    await service.garantirSeed(2);

    expect(checklist.listarPorModulos).toHaveBeenCalledWith(['FAT', 'CTB']);
  });

  it('cria uma atividade por linha do roteiro, numerando a ordem dentro da visita', async () => {
    projetos.findOne.mockResolvedValue({
      id: 3,
      modulos: 'FAT',
      modulosDetalhe: null,
    });
    checklist.listarPorModulos.mockResolvedValue([
      { modulo: 'FAT', seq: '1', menu: '2.1.A', item: 'Emitir nota', acao: '' },
      { modulo: 'FAT', seq: '1', menu: '2.1.B', item: 'Conferir', acao: '' },
      { modulo: 'FAT', seq: '', menu: 'x', item: 'sem seq', acao: '' },
    ]);

    await service.garantirSeed(3);

    const salvas = atividades.save.mock.calls[0][0] as AtividadeCronograma[];
    // A linha sem `seq` não vira visita — não há bloco a que ela pertença.
    expect(salvas).toHaveLength(2);
    expect(salvas.map((a) => [a.seq, a.ordem, a.descricao])).toEqual([
      [1, 1, '2.1.A - Emitir nota'],
      [1, 2, '2.1.B - Conferir'],
    ]);
    expect(salvas.every((a) => a.status === 'Solicitada')).toBe(true);
  });

  it('é idempotente: com atividades já semeadas, não relê o catálogo', async () => {
    atividades.count.mockResolvedValue(12);
    projetos.findOne.mockResolvedValue({
      id: 4,
      modulos: '8',
      modulosDetalhe: null,
    });

    await service.garantirSeed(4);

    expect(checklist.listarPorModulos).not.toHaveBeenCalled();
    expect(atividades.save).not.toHaveBeenCalled();
  });
});
