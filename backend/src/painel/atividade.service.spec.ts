import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AtividadeService } from './atividade.service';
import { MetricasService } from '../metricas/metricas.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';
import type { AuthUser } from '../common/decorators/current-user.decorator';

function projeto(over: Partial<Projeto> = {}): Projeto {
  return {
    id: 1,
    cliente: 'Cliente X',
    etapa: 'Projeto',
    situacao: 'Em andamento',
    consultor: '',
    gci: '',
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  } as Projeto;
}

function usuario(over: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: 1,
    login: 'x',
    nome: 'Ana',
    perfil: 'ADM',
    codigoSicla: '',
    ...over,
  };
}

describe('AtividadeService', () => {
  let service: AtividadeService;
  const projetos = { find: jest.fn() };
  const eventos = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtividadeService,
        MetricasService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(Evento), useValue: eventos },
      ],
    }).compile();
    service = module.get(AtividadeService);
  });

  it('não consulta eventos quando não há projetos visíveis', async () => {
    projetos.find.mockResolvedValue([]);

    const r = await service.painel(usuario());

    expect(eventos.find).not.toHaveBeenCalled();
    expect(r.feed).toEqual([]);
  });

  it('monta o feed com o nome do cliente e limita a 60 itens', async () => {
    projetos.find.mockResolvedValue([projeto({ id: 1, cliente: 'Cliente X' })]);
    eventos.find.mockResolvedValue([
      {
        id: 1,
        projetoId: 1,
        tipo: 'nota',
        descricao: 'x',
        autor: 'Ana',
        criadoEm: new Date(),
      },
    ]);

    const r = await service.painel(usuario());

    expect(r.feed).toEqual([
      expect.objectContaining({ id: 1, cliente: 'Cliente X' }),
    ]);
    expect(r.funil.reduce((n, f) => n + f.n, 0)).toBe(1);
  });
});
