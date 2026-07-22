import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentesService } from './agentes.service';
import { AgenteExecucao } from '../database/entities/agente-execucao.entity';

describe('AgentesService', () => {
  let service: AgentesService;

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const repo = {
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder.select.mockReturnThis();
    queryBuilder.addSelect.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.groupBy.mockReturnThis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentesService,
        { provide: getRepositoryToken(AgenteExecucao), useValue: repo },
      ],
    }).compile();
    service = module.get(AgentesService);
  });

  it('iniciar grava com status em_execucao e agentePaiId nulo por padrão', async () => {
    const r = await service.iniciar({ agente: 'painel-core', tarefa: 'X' });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agente: 'painel-core',
        status: 'em_execucao',
        agentePaiId: null,
      }),
    );
    expect(r.id).toBe(1);
  });

  it('concluir lança NotFound se a execução não existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.concluir(999, { status: 'concluido' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('concluir seta status/resultado/concluidoEm e salva', async () => {
    const existente = {
      id: 5,
      agente: 'qualidade',
      status: 'em_execucao',
    } as AgenteExecucao;
    repo.findOne.mockResolvedValue(existente);
    const r = await service.concluir(5, {
      status: 'falhou',
      resultado: 'quebrou o teste X',
    });
    expect(r.status).toBe('falhou');
    expect(r.resultado).toBe('quebrou o teste X');
    expect(r.concluidoEm).toBeInstanceOf(Date);
  });

  it('listar filtra por em_execucao quando ativos=true', async () => {
    repo.find.mockResolvedValue([]);
    await service.listar(true, 10);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'em_execucao' } }),
    );
  });

  it('grafo nunca inventa atividade: agente sem linha no banco vem ativo=false, execucoes24h=0', async () => {
    queryBuilder.getRawMany.mockResolvedValue([]);
    const { nos, arestas } = await service.grafo();
    expect(nos.length).toBe(13); // os 13 agentes reais de .claude/agents/
    expect(nos.every((n) => n.ativo === false && n.execucoes24h === 0)).toBe(
      true,
    );
    expect(arestas.length).toBeGreaterThan(0);
  });

  it('grafo reflete execução real vinda do banco', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      { agente: 'painel-core', total: '3', ativos: '1' },
    ]);
    const { nos } = await service.grafo();
    const painelCore = nos.find((n) => n.id === 'painel-core');
    expect(painelCore?.ativo).toBe(true);
    expect(painelCore?.execucoes24h).toBe(3);
  });
});
