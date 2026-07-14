import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { Projeto } from '../database/entities/projeto.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CronogramaService } from '../cronograma/cronograma.service';
import { DesignacoesService } from '../cronograma/designacoes.service';
import { LevantamentoRespostaService } from '../levantamento/levantamento-resposta.service';
import { DocConteudoService } from '../levantamento/doc-conteudo.service';
import { DocumentosService } from '../documentos/documentos.service';

describe('ProjetosService', () => {
  let service: ProjetosService;

  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
    remove: jest.fn(),
  };

  // Limpadores de projeto (chamados por `excluir`) — cada módulo com dado por-projeto
  // registra um aqui; ver comentário em projetos.service.ts.
  const cronograma = { limparProjeto: jest.fn() };
  const designacoes = { limparProjeto: jest.fn() };
  const levantamentoResposta = { limparProjeto: jest.fn() };
  const docConteudo = { limparProjeto: jest.fn() };
  const documentos = { limparProjeto: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjetosService,
        { provide: getRepositoryToken(Projeto), useValue: repo },
        { provide: CronogramaService, useValue: cronograma },
        { provide: DesignacoesService, useValue: designacoes },
        { provide: LevantamentoRespostaService, useValue: levantamentoResposta },
        { provide: DocConteudoService, useValue: docConteudo },
        { provide: DocumentosService, useValue: documentos },
      ],
    }).compile();
    service = module.get(ProjetosService);
  });

  function user(perfil: AuthUser['perfil'], nome = 'Fulano'): AuthUser {
    return { sub: 1, login: 'x', nome, perfil, codigoSicla: '' };
  }

  it('ADM/gestão vê tudo — não aplica filtro por nome', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('ADM'));
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('p.gci'),
      expect.anything(),
    );
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('p.consultor'),
      expect.anything(),
    );
  });

  it('GCI só vê onde é GCI (_so_meus)', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('GCI', 'Ana'));
    expect(qb.andWhere).toHaveBeenCalledWith('p.gci = :nome', { nome: 'Ana' });
  });

  it('Consultor só vê onde é consultor designado (_so_meus)', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('Consultor', 'Beto'));
    expect(qb.andWhere).toHaveBeenCalledWith('p.consultor = :nome', {
      nome: 'Beto',
    });
  });

  it('calcula paginação corretamente', async () => {
    qb.getCount.mockResolvedValue(45);
    qb.getMany.mockResolvedValue([]);
    const res = await service.listar({ page: 2, limit: 20 }, user('ADM'));
    expect(res.pagination).toEqual({
      page: 2,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
    });
    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it('buscarPorId lança NotFoundException quando não existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.buscarPorId(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('atualizar mescla os campos enviados sem apagar os demais', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      cliente: 'Antigo',
      situacao: 'Em andamento',
    });
    const atualizado = await service.atualizar(1, { situacao: 'Em risco' });
    expect(atualizado).toMatchObject({
      cliente: 'Antigo',
      situacao: 'Em risco',
    });
  });

  it('excluir limpa os dados de todos os módulos antes de remover o projeto (sem FK cascade no schema)', async () => {
    const projeto = { id: 7, cliente: 'Cliente X' };
    repo.findOne.mockResolvedValue(projeto);
    await service.excluir(7);
    expect(cronograma.limparProjeto).toHaveBeenCalledWith(7);
    expect(designacoes.limparProjeto).toHaveBeenCalledWith(7);
    expect(levantamentoResposta.limparProjeto).toHaveBeenCalledWith(7);
    expect(docConteudo.limparProjeto).toHaveBeenCalledWith(7);
    expect(documentos.limparProjeto).toHaveBeenCalledWith(7);
    expect(repo.remove).toHaveBeenCalledWith(projeto);
  });
});
