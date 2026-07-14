import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { Usuario } from '../database/entities/usuario.entity';

describe('UsersService', () => {
  let service: UsersService;
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getOne: jest.fn(),
  };
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((e) => Promise.resolve({ id: e.id ?? 1, ...e })),
    create: jest.fn((dto) => dto),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(Usuario), useValue: repo }],
    }).compile();
    service = module.get(UsersService);
  });

  describe('buscarPorId', () => {
    it('lança NotFoundException quando não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.buscarPorId(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('existeUsuario', () => {
    it('devolve false sem consultar o repositório quando login e email vêm vazios', async () => {
      const r = await service.existeUsuario('', '');
      expect(r).toBe(false);
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('devolve true quando encontra por login OU email', async () => {
      qb.getCount.mockResolvedValue(1);
      const r = await service.existeUsuario('joao', 'joao@x.com');
      expect(r).toBe(true);
    });

    it('exclui o próprio id ao editar (ignorarId)', async () => {
      qb.getCount.mockResolvedValue(0);
      await service.existeUsuario('joao', 'joao@x.com', 5);
      expect(qb.andWhere).toHaveBeenCalledWith('u.id != :id', { id: 5 });
    });
  });

  describe('emailDoUsuario', () => {
    it('devolve null para nome vazio, sem consultar o repositório', async () => {
      const r = await service.emailDoUsuario('');
      expect(r).toBeNull();
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('prefere o campo email; cai no login se email vazio', async () => {
      qb.getOne.mockResolvedValue({ email: '', login: 'joao.login' });
      const r = await service.emailDoUsuario('João');
      expect(r).toBe('joao.login');
    });

    it('devolve null quando não encontra usuário ativo com esse nome', async () => {
      qb.getOne.mockResolvedValue(null);
      const r = await service.emailDoUsuario('Ninguém');
      expect(r).toBeNull();
    });
  });

  describe('criar', () => {
    it('login em branco usa o e-mail', async () => {
      qb.getCount.mockResolvedValue(0);
      await service.criar({
        login: '',
        nome: 'X',
        email: 'x@teste.com',
        senha: 'segredo1',
        perfil: 'Consultor',
        codigoSicla: '007',
      });
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ login: 'x@teste.com' }));
    });

    it('rejeita login ou e-mail já cadastrado', async () => {
      qb.getCount.mockResolvedValue(1);
      await expect(
        service.criar({
          login: 'x',
          nome: 'X',
          email: 'x@teste.com',
          senha: 'segredo1',
          perfil: 'Consultor',
          codigoSicla: '007',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('atualizar', () => {
    it('não altera a senha quando não enviada', async () => {
      const existente = {
        id: 1,
        login: 'x',
        nome: 'X',
        email: 'x@teste.com',
        senhaHash: 'hash-antigo',
        perfil: 'Consultor',
        codigoSicla: '007',
        ativo: true,
      };
      repo.findOne.mockResolvedValue(existente);
      qb.getCount.mockResolvedValue(0);
      await service.atualizar(1, { nome: 'Novo Nome' });
      expect(existente.senhaHash).toBe('hash-antigo');
      expect(existente.nome).toBe('Novo Nome');
    });

    it('altera a senha (hasheada) quando enviada', async () => {
      const existente = {
        id: 1,
        login: 'x',
        nome: 'X',
        email: 'x@teste.com',
        senhaHash: 'hash-antigo',
        perfil: 'Consultor',
        codigoSicla: '007',
        ativo: true,
      };
      repo.findOne.mockResolvedValue(existente);
      qb.getCount.mockResolvedValue(0);
      await service.atualizar(1, { senha: 'nova-senha-123' });
      expect(existente.senhaHash).not.toBe('hash-antigo');
    });

    it('rejeita quando o novo login/email já pertence a outro usuário', async () => {
      repo.findOne.mockResolvedValue({ id: 1, login: 'x', email: 'x@teste.com' });
      qb.getCount.mockResolvedValue(1);
      await expect(service.atualizar(1, { email: 'ocupado@teste.com' })).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
