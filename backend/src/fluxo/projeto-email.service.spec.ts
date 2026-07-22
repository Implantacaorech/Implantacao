import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjetoEmailService } from './projeto-email.service';
import { Projeto } from '../database/entities/projeto.entity';
import { DocumentosService } from '../documentos/documentos.service';
import { MailerService } from '../email/mailer.service';
import { ModeloEmailService } from '../email/modelo-email.service';

describe('ProjetoEmailService', () => {
  let service: ProjetoEmailService;
  const projetos = { findOne: jest.fn() };
  const modelos = {
    listar: jest.fn(),
    renderizar: jest.fn((texto: string) => `[${texto}]`),
  };
  const mailer = { configurado: jest.fn(), enviar: jest.fn() };
  const documentos = { registrarEvento: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjetoEmailService,
        { provide: getRepositoryToken(Projeto), useValue: projetos },
        { provide: ModeloEmailService, useValue: modelos },
        { provide: MailerService, useValue: mailer },
        { provide: DocumentosService, useValue: documentos },
      ],
    }).compile();
    service = module.get(ProjetoEmailService);
  });

  describe('dadosTela', () => {
    it('404 se o projeto não existe', async () => {
      projetos.findOne.mockResolvedValue(null);
      await expect(service.dadosTela(1)).rejects.toThrow(NotFoundException);
    });

    it('renderiza os modelos ativos com os dados do projeto e devolve o destino padrão', async () => {
      projetos.findOne.mockResolvedValue({
        id: 1,
        cliente: 'X',
        contatoEmail: 'contato@x.com',
      });
      modelos.listar.mockResolvedValue([
        {
          id: 5,
          nome: 'Boas-vindas',
          assunto: 'Assunto {{CLIENTE}}',
          corpo: 'Corpo {{CLIENTE}}',
        },
      ]);
      mailer.configurado.mockReturnValue(true);

      const r = await service.dadosTela(1);
      expect(r.cliente).toBe('X');
      expect(r.destinoPadrao).toBe('contato@x.com');
      expect(r.configurado).toBe(true);
      expect(r.tpls['5']).toEqual({
        nome: 'Boas-vindas',
        assunto: '[Assunto {{CLIENTE}}]',
        corpo: '[Corpo {{CLIENTE}}]',
      });
      expect(modelos.listar).toHaveBeenCalledWith(true);
    });

    it('sem e-mail de contato: destinoPadrao fica vazio', async () => {
      projetos.findOne.mockResolvedValue({
        id: 1,
        cliente: 'X',
        contatoEmail: '',
      });
      modelos.listar.mockResolvedValue([]);
      mailer.configurado.mockReturnValue(false);
      const r = await service.dadosTela(1);
      expect(r.destinoPadrao).toBe('');
    });
  });

  describe('enviar', () => {
    it('404 se o projeto não existe', async () => {
      projetos.findOne.mockResolvedValue(null);
      await expect(
        service.enviar(1, 'a@x.com', 'Oi', 'Corpo', 'ana'),
      ).rejects.toThrow(NotFoundException);
    });

    it('SMTP não configurado: não tenta enviar', async () => {
      projetos.findOne.mockResolvedValue({ id: 1 });
      mailer.configurado.mockReturnValue(false);
      const r = await service.enviar(1, 'a@x.com', 'Oi', 'Corpo', 'ana');
      expect(r).toEqual({ enviado: false, erro: 'SMTP não configurado.' });
      expect(mailer.enviar).not.toHaveBeenCalled();
    });

    it('destino vazio: erro sem tentar enviar', async () => {
      projetos.findOne.mockResolvedValue({ id: 1 });
      mailer.configurado.mockReturnValue(true);
      const r = await service.enviar(1, '   ', 'Oi', 'Corpo', 'ana');
      expect(r).toEqual({ enviado: false, erro: 'Informe o destinatário.' });
      expect(mailer.enviar).not.toHaveBeenCalled();
    });

    it('sucesso: envia e registra evento com o texto de sucesso', async () => {
      projetos.findOne.mockResolvedValue({ id: 1 });
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true });
      const r = await service.enviar(
        1,
        'a@x.com, b@x.com',
        'Assunto X',
        'Corpo X',
        'ana',
      );
      expect(r).toEqual({ enviado: true });
      expect(mailer.enviar).toHaveBeenCalledWith(
        'a@x.com, b@x.com',
        'Assunto X',
        'Corpo X',
      );
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        1,
        'email',
        'E-mail enviado a a@x.com, b@x.com — Assunto X',
        'ana',
      );
    });

    it('falha no envio: registra evento de falha e devolve o erro', async () => {
      projetos.findOne.mockResolvedValue({ id: 1 });
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: false, erro: 'timeout' });
      const r = await service.enviar(
        1,
        'a@x.com',
        'Assunto X',
        'Corpo X',
        'ana',
      );
      expect(r).toEqual({ enviado: false, erro: 'timeout' });
      expect(documentos.registrarEvento).toHaveBeenCalledWith(
        1,
        'email',
        'Falha ao enviar e-mail a a@x.com: timeout',
        'ana',
      );
    });
  });
});
