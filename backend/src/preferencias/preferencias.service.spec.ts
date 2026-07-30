import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PreferenciaUsuario } from '../database/entities/preferencia-usuario.entity';
import { PreferenciasService } from './preferencias.service';
import { TAMANHO_MAX_PREFERENCIA } from './preferencias.constants';

describe('PreferenciasService', () => {
  let service: PreferenciasService;
  const repo = { find: jest.fn(), upsert: jest.fn(), delete: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferenciasService,
        { provide: getRepositoryToken(PreferenciaUsuario), useValue: repo },
      ],
    }).compile();
    service = module.get(PreferenciasService);
  });

  describe('todas', () => {
    it('devolve mapa chave -> valor desserializado', async () => {
      repo.find.mockResolvedValue([
        {
          chave: 'capacidade',
          valor: '{"setor":"GRM-Implantação","semanas":8}',
        },
        { chave: 'carteira', valor: '{"vista":"tabela"}' },
      ]);

      expect(await service.todas(1)).toEqual({
        capacidade: { setor: 'GRM-Implantação', semanas: 8 },
        carteira: { vista: 'tabela' },
      });
    });

    it('lê SÓ as preferências do usuário pedido', async () => {
      await service.todas(42);

      expect(repo.find).toHaveBeenCalledWith({ where: { usuarioId: 42 } });
    });

    it('ignora linha com JSON corrompido em vez de derrubar a chamada', async () => {
      repo.find.mockResolvedValue([
        { chave: 'ruim', valor: '{isso não é json' },
        { chave: 'boa', valor: '{"q":"x"}' },
      ]);

      expect(await service.todas(1)).toEqual({ boa: { q: 'x' } });
    });
  });

  describe('salvar', () => {
    it('grava o JSON no par usuário × chave (upsert, sem perder corrida)', async () => {
      await service.salvar(7, 'capacidade', { setor: 'GRM-Suporte' });

      expect(repo.upsert).toHaveBeenCalledWith(
        { usuarioId: 7, chave: 'capacidade', valor: '{"setor":"GRM-Suporte"}' },
        ['usuarioId', 'chave'],
      );
    });

    it('aceita chave com ponto, hífen e sublinhado', async () => {
      await service.salvar(1, 'bi.clientes-siger_v2', {});

      expect(repo.upsert).toHaveBeenCalled();
    });

    it.each([
      '',
      'Capacidade',
      'bi/clientes',
      'com espaço',
      '.oculto',
      'a'.repeat(61),
    ])('recusa chave inválida (%p)', async (chave) => {
      await expect(service.salvar(1, chave, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('recusa valor acima do teto de tamanho', async () => {
      const gigante = { lixo: 'x'.repeat(TAMANHO_MAX_PREFERENCIA) };

      await expect(service.salvar(1, 'tela', gigante)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('serializa `undefined` como null — a tela pode zerar a preferência', async () => {
      await service.salvar(1, 'tela', undefined);

      expect(repo.upsert).toHaveBeenCalledWith(
        { usuarioId: 1, chave: 'tela', valor: 'null' },
        ['usuarioId', 'chave'],
      );
    });
  });

  describe('remover', () => {
    it('apaga só a chave daquele usuário', async () => {
      await service.remover(9, 'carteira');

      expect(repo.delete).toHaveBeenCalledWith({
        usuarioId: 9,
        chave: 'carteira',
      });
    });

    it('valida a chave também no remover', async () => {
      await expect(service.remover(9, 'NÃO VALE')).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
