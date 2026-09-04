import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuadrosService } from './quadros.service';
import { QuadrosRepository } from './repositories/quadros.repository';
import { ListasRepository } from './repositories/listas.repository';
import { CartoesRepository } from './repositories/cartoes.repository';
import { DesignadosRepository } from './repositories/designados.repository';
import { UsersService } from '../users/users.service';
import { PermissoesService } from '../permissoes/permissoes.service';
import { EscopoClienteService } from '../permissoes/escopo-cliente.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const USER = {
  sub: 7,
  login: 'ever',
  nome: 'Everton',
  perfil: 'Consultor',
  perfis: ['Consultor'],
  codigoSicla: '',
} as AuthUser;

describe('QuadrosService', () => {
  let service: QuadrosService;
  const quadros = {
    listar: jest.fn(),
    porCodigo: jest.fn(),
    porId: jest.fn(),
    criar: jest.fn(),
    responsaveis: jest.fn(),
    ehResponsavel: jest.fn(),
    incluirResponsavel: jest.fn(),
    removerResponsavel: jest.fn(),
    contarResponsaveis: jest.fn(),
  };
  const listas = { dosQuadros: jest.fn(), criarVarias: jest.fn() };
  const cartoes = { dosQuadros: jest.fn() };
  const usuarios = { listar: jest.fn(), buscarPorId: jest.fn() };
  const permissoes = { nivelEfetivo: jest.fn() };
  const escopo = { escopoDe: jest.fn() };
  const designados = {
    doProjeto: jest.fn(),
    projetosDe: jest.fn(),
    projetoPorId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    permissoes.nivelEfetivo.mockReturnValue('alteracao');
    escopo.escopoDe.mockResolvedValue({ interno: true });
    usuarios.listar.mockResolvedValue([
      { id: 7, nome: 'Everton' },
      { id: 9, nome: 'Marina' },
    ]);
    listas.dosQuadros.mockResolvedValue([]);
    cartoes.dosQuadros.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuadrosService,
        { provide: QuadrosRepository, useValue: quadros },
        { provide: ListasRepository, useValue: listas },
        { provide: CartoesRepository, useValue: cartoes },
        { provide: UsersService, useValue: usuarios },
        { provide: PermissoesService, useValue: permissoes },
        { provide: EscopoClienteService, useValue: escopo },
        { provide: DesignadosRepository, useValue: designados },
      ],
    }).compile();
    service = module.get(QuadrosService);
  });

  describe('listar (o rail da esquerda)', () => {
    beforeEach(() => {
      quadros.listar.mockResolvedValue([
        {
          id: 1,
          codigoClienteSicla: '10482',
          nomeCliente: 'Vale Verde',
          projetoId: 1,
        },
        {
          id: 2,
          codigoClienteSicla: '20913',
          nomeCliente: 'Serra Azul',
          projetoId: 2,
        },
      ]);
      quadros.responsaveis.mockResolvedValue([
        { quadroId: 1, usuarioId: 7, principal: true },
        { quadroId: 2, usuarioId: 9, principal: true },
      ]);
    });

    it('separa meus clientes dos demais pelo vínculo de responsável', async () => {
      const r = await service.listar(USER);
      expect(r.meus.map((q) => q.codigoClienteSicla)).toEqual(['10482']);
      expect(r.demais.map((q) => q.codigoClienteSicla)).toEqual(['20913']);
    });

    it('devolve os consultores da aba "Demais" para o filtro', async () => {
      const r = await service.listar(USER);
      expect(r.consultores).toEqual([{ usuarioId: 9, nome: 'Marina' }]);
    });

    it('não oferece no filtro um consultor que só responde por quadro MEU', async () => {
      quadros.responsaveis.mockResolvedValue([
        { quadroId: 1, usuarioId: 7, principal: true },
        { quadroId: 1, usuarioId: 9, principal: false },
        { quadroId: 2, usuarioId: 7, principal: true },
      ]);
      const r = await service.listar(USER);
      expect(r.demais).toEqual([]);
      expect(r.consultores).toEqual([]);
    });

    it('conta os cartões em aberto por tipo', async () => {
      cartoes.dosQuadros.mockResolvedValue([
        { quadroId: 1, listaId: 10, visivelCliente: false, concluidoEm: null },
        { quadroId: 1, listaId: 10, visivelCliente: true, concluidoEm: null },
        {
          quadroId: 1,
          listaId: 10,
          visivelCliente: true,
          concluidoEm: new Date(),
        },
      ]);
      const r = await service.listar(USER);
      expect(r.meus[0].abertosInternos).toBe(1);
      expect(r.meus[0].abertosCompartilhados).toBe(1);
    });

    it('o usuário-cliente recebe só o próprio quadro, e ele conta como "meu"', async () => {
      escopo.escopoDe.mockResolvedValue({ interno: false, codigos: ['20913'] });
      const r = await service.listar(USER);
      expect(r.meus.map((q) => q.codigoClienteSicla)).toEqual(['20913']);
      expect(r.demais).toEqual([]);
      expect(r.meus[0].abertosInternos).toBe(0);
    });
  });

  describe('abrir', () => {
    it('exige o projeto — é a designação dele que define quem responde', async () => {
      quadros.porCodigo.mockResolvedValue(null);
      await expect(
        service.abrir(USER, '10482', 'Vale Verde', null),
      ).rejects.toThrow(/Escolha o projeto/);
    });

    it('recusa quem não está designado a atender o cliente', async () => {
      quadros.porCodigo.mockResolvedValue(null);
      designados.projetoPorId.mockResolvedValue({
        id: 5,
        consultor: 'Outro',
        gci: '',
      });
      designados.doProjeto.mockResolvedValue([
        { usuarioId: 99, pessoa: 'Outro' },
      ]);
      await expect(
        service.abrir(USER, '10482', 'Vale Verde', 5),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cria com as colunas padrão e semeia os designados como responsáveis', async () => {
      quadros.porCodigo.mockResolvedValue(null);
      designados.projetoPorId.mockResolvedValue({
        id: 5,
        cliente: 'Vale Verde',
        consultor: '',
        gci: '',
      });
      designados.doProjeto.mockResolvedValue([
        { usuarioId: 7, pessoa: 'Everton', papel: 'consultor' },
        { usuarioId: 9, pessoa: 'Marina', papel: 'gci' },
        { usuarioId: 11, pessoa: 'Levantador', papel: 'levantador' },
      ]);
      quadros.criar.mockResolvedValue({
        id: 1,
        codigoClienteSicla: '10482',
        projetoId: 5,
      });

      await service.abrir(USER, '10482', 'Vale Verde', 5);

      const colunas = listas.criarVarias.mock.calls[0][0];
      expect(colunas.map((c: { titulo: string }) => c.titulo)).toEqual([
        'A fazer',
        'Em andamento',
        'Com o cliente',
        'Concluído',
        'Bastidor Rech',
      ]);
      expect(colunas[4].visivelCliente).toBe(false);
      const vinculados = quadros.incluirResponsavel.mock.calls.map((c) => c[1]);
      expect(vinculados).toContain(7);
      expect(vinculados).toContain(9);
      // Levantador não responde pelo quadro: o levantamento acaba antes da implantação.
      expect(vinculados).not.toContain(11);
    });

    it('é idempotente — pedir de novo devolve o quadro que já existe', async () => {
      quadros.porCodigo.mockResolvedValue({
        id: 1,
        codigoClienteSicla: '10482',
        projetoId: 5,
      });
      designados.doProjeto.mockResolvedValue([]);
      const q = await service.abrir(USER, '10482', 'Vale Verde', 5);
      expect(q.id).toBe(1);
      expect(quadros.criar).not.toHaveBeenCalled();
    });

    it('usuário-cliente não abre quadro', async () => {
      escopo.escopoDe.mockResolvedValue({ interno: false, codigos: ['10482'] });
      await expect(service.abrir(USER, '10482', 'x', 5)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('acesso ao quadro', () => {
    it('quadro de outro cliente responde 404 para o usuário-cliente (não confirma que existe)', async () => {
      escopo.escopoDe.mockResolvedValue({ interno: false, codigos: ['99999'] });
      quadros.porCodigo.mockResolvedValue({
        id: 1,
        codigoClienteSicla: '10482',
      });
      await expect(service.exigirLegivel(USER, '10482')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('interno não responsável LÊ, mas não edita', async () => {
      quadros.porCodigo.mockResolvedValue({
        id: 1,
        codigoClienteSicla: '10482',
      });
      quadros.ehResponsavel.mockResolvedValue(false);
      await expect(service.exigirLegivel(USER, '10482')).resolves.toBeDefined();
      await expect(service.exigirEditavel(USER, '10482')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('responsáveis', () => {
    beforeEach(() => {
      quadros.porCodigo.mockResolvedValue({
        id: 1,
        codigoClienteSicla: '10482',
      });
      quadros.ehResponsavel.mockResolvedValue(true);
    });

    it('não deixa remover o último — o quadro ficaria sem quem o edite', async () => {
      quadros.contarResponsaveis.mockResolvedValue(1);
      await expect(
        service.removerResponsavel(USER, '10482', 7),
      ).rejects.toThrow(/ao menos um responsável/);
    });

    it('remove quando há outro', async () => {
      quadros.contarResponsaveis.mockResolvedValue(2);
      await service.removerResponsavel(USER, '10482', 9);
      expect(quadros.removerResponsavel).toHaveBeenCalledWith(1, 9);
    });

    it('não aceita usuário-cliente como responsável', async () => {
      usuarios.buscarPorId.mockResolvedValue({ id: 50, perfil: 'Cliente' });
      await expect(
        service.incluirResponsavel(USER, '10482', 50),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
