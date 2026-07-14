import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CadastroService } from './cadastro.service';
import { CadastroPendente } from '../database/entities/cadastro-pendente.entity';
import { Usuario } from '../database/entities/usuario.entity';

describe('CadastroService', () => {
  let service: CadastroService;
  const qbPendentes = {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    getOne: jest.fn(),
  };
  const pendentesRepo = {
    delete: jest.fn(),
    save: jest.fn((e) => Promise.resolve({ id: e.id ?? 1, ...e })),
    create: jest.fn((dto) => dto),
    remove: jest.fn(),
    createQueryBuilder: jest.fn((alias?: string) => qbPendentes),
  };
  const usuariosRepo = {
    save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
    create: jest.fn((dto) => dto),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CadastroService,
        { provide: getRepositoryToken(CadastroPendente), useValue: pendentesRepo },
        { provide: getRepositoryToken(Usuario), useValue: usuariosRepo },
      ],
    }).compile();
    service = module.get(CadastroService);
  });

  describe('gerarCodigo', () => {
    it('gera sempre 6 dígitos numéricos, com zero à esquerda quando preciso', () => {
      for (let i = 0; i < 20; i++) {
        expect(service.gerarCodigo()).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('salvarPendente', () => {
    it('apaga qualquer pendente anterior do mesmo e-mail antes de criar o novo', async () => {
      await service.salvarPendente('Ana', 'ana@teste.com', 'ana@teste.com', 'senha123', '123456', '007');
      expect(qbPendentes.delete).toHaveBeenCalled();
      expect(pendentesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Ana', codigo: '123456', codigoSicla: '007' }),
      );
      // a senha nunca é gravada em texto puro
      const salvo = pendentesRepo.save.mock.calls[0][0];
      expect(salvo.senhaHash).not.toBe('senha123');
    });
  });

  describe('atualizarCodigo', () => {
    it('devolve false quando não existe pendente para o e-mail', async () => {
      qbPendentes.getOne.mockResolvedValue(null);
      const r = await service.atualizarCodigo('ninguem@teste.com', '111111');
      expect(r).toBe(false);
    });

    it('renova código, zera tentativas e reseta criadoEm', async () => {
      const pendente = { id: 1, codigo: '000000', tentativas: 3, criadoEm: new Date('2020-01-01') };
      qbPendentes.getOne.mockResolvedValue(pendente);
      const r = await service.atualizarCodigo('ana@teste.com', '999999');
      expect(r).toBe(true);
      expect(pendente.codigo).toBe('999999');
      expect(pendente.tentativas).toBe(0);
      expect(pendente.criadoEm.getFullYear()).toBeGreaterThan(2020);
    });
  });

  describe('confirmarPendente', () => {
    it('cadastro não encontrado', async () => {
      qbPendentes.getOne.mockResolvedValue(null);
      const r = await service.confirmarPendente('ninguem@teste.com', '123456');
      expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('não encontrado') });
    });

    it('código expirado (> 30min) apaga o pendente', async () => {
      const pendente = {
        id: 1,
        codigo: '123456',
        tentativas: 0,
        criadoEm: new Date(Date.now() - 31 * 60_000),
      };
      qbPendentes.getOne.mockResolvedValue(pendente);
      const r = await service.confirmarPendente('ana@teste.com', '123456');
      expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('expirou') });
      expect(pendentesRepo.remove).toHaveBeenCalledWith(pendente);
    });

    it('5ª tentativa errada apaga o pendente (lockout por tentativas)', async () => {
      const pendente = { id: 1, codigo: '123456', tentativas: 5, criadoEm: new Date() };
      qbPendentes.getOne.mockResolvedValue(pendente);
      const r = await service.confirmarPendente('ana@teste.com', '000000');
      expect(r).toEqual({ ok: false, mensagem: expect.stringContaining('Muitas tentativas') });
      expect(pendentesRepo.remove).toHaveBeenCalledWith(pendente);
    });

    it('código incorreto incrementa tentativas sem apagar o pendente', async () => {
      const pendente = { id: 1, codigo: '123456', tentativas: 1, criadoEm: new Date() };
      qbPendentes.getOne.mockResolvedValue(pendente);
      const r = await service.confirmarPendente('ana@teste.com', '000000');
      expect(r.ok).toBe(false);
      expect(pendente.tentativas).toBe(2);
      expect(pendentesRepo.remove).not.toHaveBeenCalled();
    });

    it('código correto cria o Usuario (perfil sempre Consultor) e apaga o pendente', async () => {
      const pendente = {
        id: 1,
        nome: 'Ana',
        login: 'ana@teste.com',
        email: 'ana@teste.com',
        senhaHash: 'hash-ja-pronto',
        codigoSicla: '007',
        codigo: '123456',
        tentativas: 0,
        criadoEm: new Date(),
      };
      qbPendentes.getOne.mockResolvedValue(pendente);
      const r = await service.confirmarPendente('ana@teste.com', '123456');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.usuario).toMatchObject({ nome: 'Ana', perfil: 'Consultor', ativo: true });
      }
      expect(usuariosRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ senhaHash: 'hash-ja-pronto', perfil: 'Consultor' }),
      );
      expect(pendentesRepo.remove).toHaveBeenCalledWith(pendente);
    });
  });
});
