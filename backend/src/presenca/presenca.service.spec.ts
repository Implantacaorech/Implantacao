import { Test, TestingModule } from '@nestjs/testing';
import { PresencaService } from './presenca.service';
import { PresencaRepository } from './repositories/presenca.repository';
import { JANELA_ONLINE_S, OCIOSO_S } from './presenca.constants';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const USER = {
  sub: 7,
  login: 'ever',
  nome: 'Everton',
  perfil: 'ADM',
  perfis: ['ADM'],
  codigoSicla: '',
} as AuthUser;

/** Linha de presença, com `ultimoPing` a N segundos atrás. */
function linha(over: Record<string, unknown> = {}, atrasSegundos = 0) {
  return {
    id: 1,
    usuarioId: 7,
    sessao: 'aba-1',
    nome: 'Everton',
    perfil: 'ADM',
    rota: '/home',
    titulo: 'Visão Geral',
    visivel: true,
    ip: '10.0.0.1',
    navegador: 'Chrome',
    iniciadoEm: new Date(Date.now() - 3600_000),
    ultimoPing: new Date(Date.now() - atrasSegundos * 1000),
    ...over,
  };
}

describe('PresencaService', () => {
  let service: PresencaService;
  const repo = {
    porUsuarioSessao: jest.fn(),
    salvar: jest.fn(),
    ativasDesde: jest.fn(),
    remover: jest.fn(),
    podarDoUsuario: jest.fn(),
    podarTudo: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.porUsuarioSessao.mockResolvedValue(null);
    repo.salvar.mockImplementation((l: unknown) => Promise.resolve(l));
    repo.ativasDesde.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresencaService,
        { provide: PresencaRepository, useValue: repo },
      ],
    }).compile();
    service = module.get(PresencaService);
  });

  describe('registrar (a batida do navegador)', () => {
    const ping = {
      sessao: 'aba-1',
      rota: '/atividades',
      titulo: 'Controle de Atividades',
      visivel: true,
    };

    it('grava onde a pessoa está', async () => {
      await service.registrar(USER, ping, '10.0.0.9', 'Chrome/1');
      const gravado = repo.salvar.mock.calls[0][0];
      expect(gravado).toMatchObject({
        usuarioId: 7,
        sessao: 'aba-1',
        nome: 'Everton',
        rota: '/atividades',
        titulo: 'Controle de Atividades',
        ip: '10.0.0.9',
      });
      expect(gravado.ultimoPing).toBeInstanceOf(Date);
    });

    it('a mesma aba ATUALIZA a linha em vez de criar outra', async () => {
      repo.porUsuarioSessao.mockResolvedValue(linha({ id: 42 }, 60));
      await service.registrar(USER, ping, '10.0.0.9', 'Chrome/1');
      expect(repo.salvar.mock.calls[0][0].id).toBe(42);
    });

    it('poda o rastro frio do próprio usuário — a tabela se mantém pequena sozinha', async () => {
      await service.registrar(USER, ping, '10.0.0.9', 'Chrome/1');
      expect(repo.podarDoUsuario).toHaveBeenCalledWith(7, expect.any(Date));
    });

    it('trunca campos longos para não estourar a coluna', async () => {
      await service.registrar(
        USER,
        { ...ping, rota: 'x'.repeat(500), titulo: 'y'.repeat(400) },
        'i'.repeat(100),
        'n'.repeat(400),
      );
      const g = repo.salvar.mock.calls[0][0];
      expect(g.rota.length).toBe(300);
      expect(g.titulo.length).toBe(160);
      expect(g.ip.length).toBe(60);
      expect(g.navegador.length).toBe(200);
    });
  });

  describe('panorama', () => {
    it('lista vazia quando ninguém bateu na janela', async () => {
      const p = await service.panorama();
      expect(p.totalUsuarios).toBe(0);
      expect(p.usuarios).toEqual([]);
    });

    it('consulta só a janela de online', async () => {
      await service.panorama();
      const desde = repo.ativasDesde.mock.calls[0][0] as Date;
      const segundos = Math.round((Date.now() - desde.getTime()) / 1000);
      expect(segundos).toBeGreaterThanOrEqual(JANELA_ONLINE_S - 2);
      expect(segundos).toBeLessThanOrEqual(JANELA_ONLINE_S + 2);
    });

    it('agrupa as abas da mesma pessoa numa linha só', async () => {
      repo.ativasDesde.mockResolvedValue([
        linha({ sessao: 'aba-1', titulo: 'Carteira' }, 5),
        linha({ id: 2, sessao: 'aba-2', titulo: 'Agenda' }, 40),
      ]);
      const p = await service.panorama();
      expect(p.totalUsuarios).toBe(1);
      expect(p.totalSessoes).toBe(2);
      expect(p.usuarios[0].sessoes).toHaveLength(2);
    });

    it('a tela mostrada é a da aba que bateu por último', async () => {
      // `ativasDesde` devolve ordenado por batida decrescente — é o contrato do repository.
      repo.ativasDesde.mockResolvedValue([
        linha({ sessao: 'recente', titulo: 'Agenda' }, 3),
        linha({ id: 2, sessao: 'antiga', titulo: 'Carteira' }, 90),
      ]);
      const p = await service.panorama();
      expect(p.usuarios[0].telaAtual).toBe('Agenda');
    });

    it('aba em segundo plano conta como ociosa', async () => {
      repo.ativasDesde.mockResolvedValue([linha({ visivel: false }, 5)]);
      const p = await service.panorama();
      expect(p.usuarios[0].ocioso).toBe(true);
    });

    it('sem batida há muito tempo também é ociosa, mesmo visível', async () => {
      repo.ativasDesde.mockResolvedValue([
        linha({ visivel: true }, OCIOSO_S + 30),
      ]);
      const p = await service.panorama();
      expect(p.usuarios[0].ocioso).toBe(true);
    });

    it('batida recente e aba em primeiro plano = ativa', async () => {
      repo.ativasDesde.mockResolvedValue([linha({ visivel: true }, 5)]);
      const p = await service.panorama();
      expect(p.usuarios[0].ocioso).toBe(false);
    });

    it('ordena por nome, para a lista não dançar a cada atualização', async () => {
      repo.ativasDesde.mockResolvedValue([
        linha({ usuarioId: 2, nome: 'Zeca' }, 5),
        linha({ id: 2, usuarioId: 3, nome: 'Ana' }, 6),
      ]);
      const p = await service.panorama();
      expect(p.usuarios.map((u) => u.nome)).toEqual(['Ana', 'Zeca']);
    });
  });

  describe('quantosOnline', () => {
    it('conta PESSOAS, não abas', async () => {
      repo.ativasDesde.mockResolvedValue([
        linha({ usuarioId: 7, sessao: 'a' }, 5),
        linha({ id: 2, usuarioId: 7, sessao: 'b' }, 5),
        linha({ id: 3, usuarioId: 9, sessao: 'c' }, 5),
      ]);
      expect(await service.quantosOnline()).toBe(2);
    });
  });

  it('encerrar apaga a sessão daquela aba', async () => {
    await service.encerrar(7, 'aba-1');
    expect(repo.remover).toHaveBeenCalledWith(7, 'aba-1');
  });
});
