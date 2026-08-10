import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DesignacoesService } from './designacoes.service';
import { Designacao } from '../database/entities/designacao.entity';
import { AtividadeCronograma } from '../database/entities/atividade-cronograma.entity';
import { Projeto } from '../database/entities/projeto.entity';
import { ProjetoPessoa } from '../database/entities/projeto-pessoa.entity';

// A lista de técnicos do Agendador saía das próprias `designacoes` — circular, porque a
// designação é o que o seletor grava. Em todo projeto cuja equipe foi indicada pelo passo 8
// ("Indicar o GCI e os técnicos responsáveis", que grava em `projeto_pessoas` e em
// `Projeto.gci`) o seletor nascia vazio e não havia como escolher ninguém.
describe('DesignacoesService.tecnicosDoProjeto', () => {
  let service: DesignacoesService;

  const designacoesRepo = { find: jest.fn() };
  const atividadesRepo = { find: jest.fn() };
  const projetosRepo = { findOne: jest.fn() };
  const pessoasRepo = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    designacoesRepo.find.mockResolvedValue([]);
    atividadesRepo.find.mockResolvedValue([]);
    projetosRepo.findOne.mockResolvedValue(null);
    pessoasRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignacoesService,
        { provide: getRepositoryToken(Designacao), useValue: designacoesRepo },
        {
          provide: getRepositoryToken(AtividadeCronograma),
          useValue: atividadesRepo,
        },
        { provide: getRepositoryToken(Projeto), useValue: projetosRepo },
        { provide: getRepositoryToken(ProjetoPessoa), useValue: pessoasRepo },
      ],
    }).compile();
    service = module.get(DesignacoesService);
  });

  it('traz a equipe do passo 8 (GCI + técnicos) mesmo sem nenhuma designação por módulo', async () => {
    projetosRepo.findOne.mockResolvedValue({ gci: 'Ana', consultor: '' });
    pessoasRepo.find.mockResolvedValue([
      { pessoa: 'Beto' },
      { pessoa: 'Carla' },
    ]);

    expect(await service.tecnicosDoProjeto(1)).toEqual([
      'Ana',
      'Beto',
      'Carla',
    ]);
    expect(pessoasRepo.find).toHaveBeenCalledWith({
      where: { projetoId: 1, papel: 'consultor' },
    });
  });

  it('separa por vírgula os campos consolidados do projeto e não repete nome', async () => {
    projetosRepo.findOne.mockResolvedValue({
      gci: 'Ana, Beto',
      consultor: 'Beto, Carla',
    });
    pessoasRepo.find.mockResolvedValue([{ pessoa: 'Carla' }]);

    expect(await service.tecnicosDoProjeto(1)).toEqual([
      'Ana',
      'Beto',
      'Carla',
    ]);
  });

  it('mantém quem já está designado por módulo ou gravado no cartão (projeto anterior ao passo 8)', async () => {
    designacoesRepo.find.mockResolvedValue([
      { consultor: 'Dora' },
      { consultor: '' },
    ]);
    atividadesRepo.find.mockResolvedValue([
      { tecnico: 'Elias' },
      { tecnico: '' },
    ]);

    expect(await service.tecnicosDoProjeto(1)).toEqual(['Dora', 'Elias']);
  });

  it('devolve lista vazia quando o projeto ainda não tem ninguém indicado', async () => {
    expect(await service.tecnicosDoProjeto(1)).toEqual([]);
  });
});
