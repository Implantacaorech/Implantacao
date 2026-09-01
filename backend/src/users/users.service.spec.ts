import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
  // QB próprio do `manager` (checagem de designações do excluir) — separado do `qb` do
  // repositório para os asserts de um não vazarem no outro.
  const qbManager = {
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };
  const manager = {
    createQueryBuilder: jest.fn(() => qbManager),
    delete: jest.fn(),
  };
  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((e) => Promise.resolve({ id: e.id ?? 1, ...e })),
    create: jest.fn((dto) => dto),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
    manager,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // `find` sem implementação devolvia `undefined` e quebrava a checagem de homônimo —
    // o TypeORM sempre devolve array, então o padrão do mock é a lista vazia.
    repo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Usuario), useValue: repo },
      ],
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
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ login: 'x@teste.com' }),
      );
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

    // O NOME é a chave de designação (`projeto_pessoas.pessoa`, `Projeto.gci`): dois
    // cadastros homônimos fazem o segundo herdar os passos e os e-mails do primeiro.
    it('rejeita um segundo usuário ATIVO com o mesmo nome', async () => {
      qb.getCount.mockResolvedValue(0);
      repo.find.mockResolvedValue([{ id: 9, nome: 'Cesar Consultor' }]);
      await expect(
        service.criar({
          login: 'outro',
          nome: '  cesar consultor ',
          email: 'outro@teste.com',
          senha: 'segredo1',
          perfil: 'Consultor',
          codigoSicla: '008',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('aceita nome igual ao de um usuário INATIVO (não é designável)', async () => {
      qb.getCount.mockResolvedValue(0);
      repo.find.mockResolvedValue([]); // `find` já filtra por ativo:true
      await expect(
        service.criar({
          login: 'novo',
          nome: 'Cesar Consultor',
          email: 'novo@teste.com',
          senha: 'segredo1',
          perfil: 'Consultor',
          codigoSicla: '009',
        }),
      ).resolves.toBeDefined();
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

    it('recusa renomear para o nome de outro usuário ativo', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        login: 'x',
        nome: 'X',
        email: 'x@teste.com',
        senhaHash: 'h',
        perfil: 'Consultor',
        codigoSicla: '',
        ativo: true,
      });
      qb.getCount.mockResolvedValue(0);
      repo.find.mockResolvedValue([{ id: 2, nome: 'Cesar Consultor' }]);
      await expect(
        service.atualizar(1, { nome: 'Cesar Consultor' }),
      ).rejects.toThrow(ConflictException);
    });

    it('editar OUTRO campo não revalida o nome (duplicidade antiga não trava a edição)', async () => {
      const existente = {
        id: 1,
        login: 'x',
        nome: 'Cesar Consultor',
        email: 'x@teste.com',
        senhaHash: 'h',
        perfil: 'Consultor' as const,
        codigoSicla: '',
        ativo: true,
      };
      repo.findOne.mockResolvedValue(existente);
      qb.getCount.mockResolvedValue(0);
      repo.find.mockResolvedValue([{ id: 2, nome: 'Cesar Consultor' }]);
      await expect(
        service.atualizar(1, { codigoSicla: '123' }),
      ).resolves.toBeDefined();
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
      repo.findOne.mockResolvedValue({
        id: 1,
        login: 'x',
        email: 'x@teste.com',
      });
      qb.getCount.mockResolvedValue(1);
      await expect(
        service.atualizar(1, { email: 'ocupado@teste.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('excluir', () => {
    const alvo = { id: 7, nome: 'Beto Consultor', login: 'beto' };

    it('lança NotFoundException quando o usuário não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.excluir(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('recusa excluir o próprio usuário logado (também garante que sempre sobra um ADM)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, nome: 'Admin' });
      await expect(service.excluir(1, 1)).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('recusa excluir quem tem designação em projeto — o caminho é desativar', async () => {
      repo.findOne.mockResolvedValue(alvo);
      qbManager.getCount.mockResolvedValue(3);
      await expect(service.excluir(7, 1)).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('exclui e remove os satélites (sessões, recuperação, preferências, exceções de permissão)', async () => {
      repo.findOne.mockResolvedValue(alvo);
      qbManager.getCount.mockResolvedValue(0);
      await service.excluir(7, 1);
      // 4 satélites, todos filtrados pelo usuário excluído — sem FK física no schema,
      // é aqui que os órfãos são evitados.
      expect(manager.delete).toHaveBeenCalledTimes(4);
      for (const chamada of manager.delete.mock.calls) {
        expect(chamada[1]).toEqual({ usuarioId: 7 });
      }
      expect(repo.delete).toHaveBeenCalledWith(7);
    });

    it('a checagem de designação cobre vínculo antigo sem usuarioId (casado pelo nome)', async () => {
      repo.findOne.mockResolvedValue(alvo);
      qbManager.getCount.mockResolvedValue(0);
      await service.excluir(7, 1);
      expect(qbManager.where).toHaveBeenCalledWith(
        expect.stringContaining(
          'pp.usuarioId IS NULL AND LOWER(TRIM(pp.pessoa))',
        ),
        { id: 7, nome: 'beto consultor' },
      );
    });
  });

  describe('trocarSenha', () => {
    it('troca a senha (hasheada) quando a senha atual confere', async () => {
      const senhaHash = await bcrypt.hash('senha-atual-123', 12);
      const existente = { id: 1, senhaHash };
      repo.findOne.mockResolvedValue(existente);
      await service.trocarSenha(1, 'senha-atual-123', 'senha-nova-456');
      expect(existente.senhaHash).not.toBe(senhaHash);
      expect(await bcrypt.compare('senha-nova-456', existente.senhaHash)).toBe(
        true,
      );
    });

    it('rejeita quando a senha atual está incorreta, sem alterar o hash', async () => {
      const senhaHash = await bcrypt.hash('senha-atual-123', 12);
      const existente = { id: 1, senhaHash };
      repo.findOne.mockResolvedValue(existente);
      await expect(
        service.trocarSenha(1, 'senha-errada', 'senha-nova-456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(existente.senhaHash).toBe(senhaHash);
    });
  });
});
