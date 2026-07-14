import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificacaoService } from './notificacao.service';
import { MailerService } from './mailer.service';
import { UsersService } from '../users/users.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Evento } from '../database/entities/evento.entity';

describe('NotificacaoService', () => {
  let service: NotificacaoService;
  const projetos = { findOne: jest.fn() };
  const mailer = { configurado: jest.fn(), enviar: jest.fn() };
  const users = { porPerfil: jest.fn() };
  const eventos = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity })),
  };

  const antigoEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test'; // notificar() aguarda inline em teste (determinístico)
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificacaoService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: getRepositoryToken(Evento), useValue: eventos },
        { provide: MailerService, useValue: mailer },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(NotificacaoService);
  });

  afterAll(() => {
    process.env.NODE_ENV = antigoEnv;
  });

  describe('emailsCoordenacao', () => {
    it('junta os logins de ADM + Coordenador', async () => {
      users.porPerfil.mockImplementation((perfil: string) =>
        Promise.resolve(
          perfil === 'ADM' ? [{ login: 'adm1' }] : [{ login: 'coord1' }, { login: '' }],
        ),
      );
      const emails = await service.emailsCoordenacao();
      expect(emails).toEqual(['adm1', 'coord1']);
    });

    it('cai para MIGRACAO_DIGEST_PARA se não houver ADM/Coordenador ativos', async () => {
      users.porPerfil.mockResolvedValue([]);
      process.env.MIGRACAO_DIGEST_PARA = 'a@x.com, b@x.com';
      const emails = await service.emailsCoordenacao();
      expect(emails).toEqual(['a@x.com', 'b@x.com']);
      delete process.env.MIGRACAO_DIGEST_PARA;
    });
  });

  describe('notificar', () => {
    it('não faz nada com lista de e-mails vazia', async () => {
      await service.notificar(1, [], 'Assunto', 'Corpo');
      expect(mailer.enviar).not.toHaveBeenCalled();
      expect(eventos.save).not.toHaveBeenCalled();
    });

    it('sucesso: envia e registra evento "Notificou..."', async () => {
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true, erro: null });
      await service.notificar(7, ['x@x.com'], 'Assunto X', 'Corpo X', 'Fulano');
      expect(eventos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projetoId: 7,
          tipo: 'email',
          descricao: expect.stringContaining('Notificou x@x.com — Assunto X'),
          autor: 'Fulano',
        }),
      );
    });

    it('sem mailer configurado: registra "Notificação pendente"', async () => {
      mailer.configurado.mockReturnValue(false);
      await service.notificar(8, ['x@x.com'], 'Assunto Y', 'Corpo Y');
      expect(eventos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projetoId: 8,
          tipo: 'email',
          descricao: expect.stringContaining('Notificação pendente'),
          autor: '',
        }),
      );
    });

    it('erro no envio: registra "Notificação pendente" com a mensagem de erro', async () => {
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: false, erro: 'SMTP indisponível' });
      await service.notificar(9, ['x@x.com'], 'Assunto Z', 'Corpo Z');
      expect(eventos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projetoId: 9,
          tipo: 'email',
          descricao: expect.stringContaining('SMTP indisponível'),
          autor: '',
        }),
      );
    });
  });

  describe('notificarEvento', () => {
    it('monta assunto/corpo do template do evento com o nome do cliente e notifica a coordenação', async () => {
      users.porPerfil.mockImplementation((perfil: string) =>
        Promise.resolve(perfil === 'ADM' ? [{ login: 'adm1' }] : []),
      );
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true, erro: null });
      await service.notificarEvento(3, 'encerrado', { cliente: 'Cliente Teste' } as any);
      expect(mailer.enviar).toHaveBeenCalledWith(
        ['adm1'],
        'Implantação encerrada — Cliente Teste',
        expect.stringContaining('A implantação de Cliente Teste foi encerrada.'),
      );
    });

    it('busca o projeto no banco quando proj não é passado', async () => {
      projetos.findOne.mockResolvedValue({ cliente: 'Do Banco' });
      users.porPerfil.mockImplementation((perfil: string) =>
        Promise.resolve(perfil === 'ADM' ? [{ login: 'adm1' }] : []),
      );
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true, erro: null });
      await service.notificarEvento(4, 'fechamento');
      expect(mailer.enviar).toHaveBeenCalledWith(
        ['adm1'],
        expect.stringContaining('Do Banco'),
        expect.anything(),
      );
    });

    it('evento desconhecido não faz nada', async () => {
      await service.notificarEvento(5, 'nao-existe' as any);
      expect(mailer.enviar).not.toHaveBeenCalled();
    });
  });
});
