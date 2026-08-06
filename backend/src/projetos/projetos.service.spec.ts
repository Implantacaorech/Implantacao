import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjetosService } from './projetos.service';
import { Projeto } from '../database/entities/projeto.entity';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CronogramaService } from '../cronograma/cronograma.service';
import { DesignacoesService } from '../cronograma/designacoes.service';
import { LevantamentoRespostaService } from '../levantamento/levantamento-resposta.service';
import { DocConteudoService } from '../levantamento/doc-conteudo.service';
import { DocumentosService } from '../documentos/documentos.service';
import { NotificacaoService } from '../email/notificacao.service';
import { PassosService } from '../passos/passos.service';

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
  const notificacao = { notificarEvento: jest.fn() };
  const passos = { definirPessoas: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjetosService,
        { provide: getRepositoryToken(Projeto), useValue: repo },
        { provide: CronogramaService, useValue: cronograma },
        { provide: DesignacoesService, useValue: designacoes },
        {
          provide: LevantamentoRespostaService,
          useValue: levantamentoResposta,
        },
        { provide: DocConteudoService, useValue: docConteudo },
        { provide: DocumentosService, useValue: documentos },
        { provide: NotificacaoService, useValue: notificacao },
        // Editar `gci`/`consultor` refaz os vínculos com usuario_id (RN-10).
        { provide: PassosService, useValue: passos },
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

  it('GCI vê onde está ligado por nome (_so_meus) — cobre lista separada por vírgula', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('GCI', 'Ana'));
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('projeto_pessoas'),
      expect.objectContaining({
        nome: 'Ana',
        nomeIni: 'Ana, %',
        nomeMeio: '%, Ana, %',
        nomeFim: '%, Ana',
      }),
    );
    // e o mesmo predicado cobre gci e consultor (não é mais só uma coluna por perfil)
    const [sql] = qb.andWhere.mock.calls.find(([s]: [string]) =>
      String(s).includes('projeto_pessoas'),
    );
    expect(sql).toContain('p.gci');
    expect(sql).toContain('p.consultor');
  });

  it('Consultor vê onde está designado (_so_meus) — via projeto_pessoas/consultor', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('Consultor', 'Beto'));
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('projeto_pessoas'),
      expect.objectContaining({ nome: 'Beto' }),
    );
  });

  it('Comercial vê TODOS os clientes — não aplica filtro por nome', async () => {
    qb.getCount.mockResolvedValue(0);
    qb.getMany.mockResolvedValue([]);
    await service.listar({ page: 1, limit: 20 }, user('Comercial', 'Vendas'));
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('projeto_pessoas'),
      expect.anything(),
    );
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
    expect(notificacao.notificarEvento).not.toHaveBeenCalled();
  });

  it('atualizar notifica "encerrado" quando a situação MUDA para Concluído', async () => {
    repo.findOne.mockResolvedValue({
      id: 2,
      cliente: 'Cliente Y',
      situacao: 'Em andamento',
    });
    await service.atualizar(2, { situacao: 'Concluído' });
    expect(notificacao.notificarEvento).toHaveBeenCalledWith(
      2,
      'encerrado',
      expect.objectContaining({ situacao: 'Concluído' }),
    );
  });

  it('atualizar NÃO notifica de novo se já estava Concluído (evita spam a cada save)', async () => {
    repo.findOne.mockResolvedValue({
      id: 3,
      cliente: 'Cliente Z',
      situacao: 'Concluído',
    });
    await service.atualizar(3, {
      situacao: 'Concluído',
      observacoes: 'ajuste',
    });
    expect(notificacao.notificarEvento).not.toHaveBeenCalled();
  });

  it('atualizar rejeita mudar a etapa pelo formulário genérico (só o botão Avançar pode)', async () => {
    repo.findOne.mockResolvedValue({
      id: 4,
      cliente: 'Cliente W',
      etapa: 'Levantamento',
    });
    await expect(service.atualizar(4, { etapa: 'Projeto' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('atualizar aceita reenviar a MESMA etapa (idempotente — não é uma troca de verdade)', async () => {
    repo.findOne.mockResolvedValue({
      id: 5,
      cliente: 'Cliente V',
      etapa: 'Levantamento',
    });
    const atualizado = await service.atualizar(5, {
      etapa: 'Levantamento',
      observacoes: 'ajuste',
    });
    expect(atualizado).toMatchObject({
      etapa: 'Levantamento',
      observacoes: 'ajuste',
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
