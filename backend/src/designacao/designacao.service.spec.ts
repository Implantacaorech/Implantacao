import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DesignacaoService } from './designacao.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { Evento } from '../database/entities/evento.entity';
import { Designacao } from '../database/entities/designacao.entity';
import { UsersService } from '../users/users.service';
import { MailerService } from '../email/mailer.service';
import { MetricasService } from '../metricas/metricas.service';

// 2026-08-10 é o "hoje" fixado para os testes de data.
const HOJE = new Date('2026-08-10T12:00:00');

describe('DesignacaoService', () => {
  let service: DesignacaoService;
  const projetosRepo = { findOne: jest.fn(), save: jest.fn((p) => Promise.resolve(p)) };
  const documentosRepo = { find: jest.fn() };
  const eventosRepo = { save: jest.fn(), create: jest.fn((dto) => dto) };
  const designacoesRepo = {
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto) => dto),
  };
  const users = { porPerfil: jest.fn(), emailDoUsuario: jest.fn() };
  const mailer = { enviar: jest.fn().mockResolvedValue({ ok: true, erro: null }) };
  const metricas = { gciDefinido: jest.fn(), autoAvancar: jest.fn().mockReturnValue([]) };

  function projeto(over: Partial<Projeto> = {}): Projeto {
    return {
      id: 1,
      cliente: 'Cliente X',
      gci: '',
      consultor: '',
      dataLevantamento: '',
      modulos: 'FAT,CTB',
      situacao: 'Em andamento',
      etapa: 'Agendamento',
      ...over,
    } as Projeto;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(HOJE);
    documentosRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignacaoService,
        { provide: getRepositoryToken(Projeto), useValue: projetosRepo },
        { provide: getRepositoryToken(Documento), useValue: documentosRepo },
        { provide: getRepositoryToken(Evento), useValue: eventosRepo },
        { provide: getRepositoryToken(Designacao), useValue: designacoesRepo },
        { provide: UsersService, useValue: users },
        { provide: MailerService, useValue: mailer },
        { provide: MetricasService, useValue: metricas },
      ],
    }).compile();
    service = module.get(DesignacaoService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('definirGci', () => {
    it('rejeita quando nenhum GCI é selecionado', async () => {
      await expect(service.definirGci(1, [], 'Admin')).rejects.toThrow(BadRequestException);
    });

    it('deduplica preservando a ordem e junta com vírgula; não envia e-mail', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto());
      const p = await service.definirGci(1, ['Ana', 'Beto', 'Ana'], 'Admin');
      expect(p.gci).toBe('Ana, Beto');
      expect(mailer.enviar).not.toHaveBeenCalled();
      expect(eventosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ descricao: expect.stringContaining('GCI(s) definido(s): Ana, Beto') }),
      );
    });
  });

  describe('agendar', () => {
    it('rejeita se o GCI ainda não foi definido', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto({ gci: '' }));
      metricas.gciDefinido.mockReturnValue(false);
      await expect(service.agendar(1, '2026-08-15', 'Admin')).rejects.toThrow(BadRequestException);
    });

    it('rejeita data no passado', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto({ gci: 'Ana' }));
      metricas.gciDefinido.mockReturnValue(true);
      await expect(service.agendar(1, '2020-01-01', 'Admin')).rejects.toThrow(BadRequestException);
    });

    it('salva a data, notifica o(s) GCI(s) resolvidos por e-mail e roda o auto-avanço', async () => {
      const p = projeto({ gci: 'Ana, Beto' });
      projetosRepo.findOne.mockResolvedValue(p);
      metricas.gciDefinido.mockReturnValue(true);
      users.emailDoUsuario.mockImplementation((n: string) =>
        Promise.resolve(n === 'Ana' ? 'ana@teste.com' : null),
      );

      await service.agendar(1, '2026-08-15', 'Admin');

      expect(p.dataLevantamento).toBe('2026-08-15');
      expect(mailer.enviar).toHaveBeenCalledWith(
        ['ana@teste.com'],
        expect.stringContaining('Levantamento agendado'),
        expect.any(String),
      );
      expect(metricas.autoAvancar).toHaveBeenCalledWith(p, []);
    });

    it('não quebra se nenhum GCI tiver e-mail resolvível', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto({ gci: 'Fulano' }));
      metricas.gciDefinido.mockReturnValue(true);
      users.emailDoUsuario.mockResolvedValue(null);
      await service.agendar(1, '2026-08-15', 'Admin');
      expect(mailer.enviar).not.toHaveBeenCalled();
    });
  });

  describe('designarConsultores', () => {
    it('rejeita quando nenhum módulo recebe consultor', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto());
      await expect(service.designarConsultores(1, {}, 'GCI Um')).rejects.toThrow(BadRequestException);
    });

    it('substitui todas as designações (apaga e reinsere) e denormaliza Projeto.consultor', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto());
      await service.designarConsultores(1, { FAT: 'Beto', CTB: 'Ana' }, 'GCI Um');
      expect(designacoesRepo.delete).toHaveBeenCalledWith({ projetoId: 1 });
      expect(designacoesRepo.save).toHaveBeenCalledWith([
        { projetoId: 1, modulo: 'FAT', consultor: 'Beto' },
        { projetoId: 1, modulo: 'CTB', consultor: 'Ana' },
      ]);
    });

    it('ignora módulos sem consultor selecionado', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto());
      await service.designarConsultores(1, { FAT: 'Beto', CTB: '' }, 'GCI Um');
      expect(designacoesRepo.save).toHaveBeenCalledWith([{ projetoId: 1, modulo: 'FAT', consultor: 'Beto' }]);
    });

    it('notifica cada consultor designado com os módulos dele', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto());
      users.emailDoUsuario.mockImplementation((n: string) => Promise.resolve(`${n.toLowerCase()}@teste.com`));
      await service.designarConsultores(1, { FAT: 'Ana', CTB: 'Ana' }, 'GCI Um');
      expect(mailer.enviar).toHaveBeenCalledWith(
        'ana@teste.com',
        expect.stringContaining('Implantação designada'),
        expect.stringContaining('FAT, CTB'),
      );
    });

    it('não notifica quando o projeto já está Concluído (evita reenvio pós-encerramento)', async () => {
      projetosRepo.findOne.mockResolvedValue(projeto({ situacao: 'Concluído' }));
      await service.designarConsultores(1, { FAT: 'Ana' }, 'GCI Um');
      expect(mailer.enviar).not.toHaveBeenCalled();
    });
  });
});
