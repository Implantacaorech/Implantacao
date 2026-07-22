import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DigestService } from './digest.service';
import { Projeto } from '../database/entities/projeto.entity';
import { Documento } from '../database/entities/documento.entity';
import { MetricasService } from '../metricas/metricas.service';
import { MailerService } from '../email/mailer.service';

describe('DigestService', () => {
  let service: DigestService;
  const projetosRepo = { find: jest.fn().mockResolvedValue([]) };
  const documentosRepo = { find: jest.fn().mockResolvedValue([]) };
  const mailer = { configurado: jest.fn(), enviar: jest.fn() };
  const config = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestService,
        MetricasService,
        { provide: getRepositoryToken(Projeto), useValue: projetosRepo },
        { provide: getRepositoryToken(Documento), useValue: documentosRepo },
        { provide: MailerService, useValue: mailer },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(DigestService);
  });

  describe('destinos', () => {
    it('separa por vírgula, ponto-e-vírgula ou quebra de linha, ignorando vazios', () => {
      config.get.mockReturnValue('a@x.com, b@x.com;\nc@x.com');
      expect(service.destinos()).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    });

    it('devolve lista vazia quando não configurado', () => {
      config.get.mockReturnValue('');
      expect(service.destinos()).toEqual([]);
    });
  });

  describe('enviar', () => {
    it('não envia sem destinatários configurados', async () => {
      config.get.mockReturnValue('');
      const r = await service.enviar();
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('destinatários');
      expect(mailer.enviar).not.toHaveBeenCalled();
    });

    it('não envia quando o e-mail não está configurado', async () => {
      config.get.mockReturnValue('a@x.com');
      mailer.configurado.mockReturnValue(false);
      const r = await service.enviar();
      expect(r.ok).toBe(false);
      expect(r.mensagem).toContain('não configurado');
    });

    it('monta o resumo com KPIs e envia para todos os destinatários', async () => {
      config.get.mockReturnValue('a@x.com,b@x.com');
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true, erro: null });
      projetosRepo.find.mockResolvedValue([
        {
          id: 1,
          situacao: 'Em risco',
          etapa: 'Projeto',
          consultor: '',
          cliente: 'X',
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
      ]);

      const r = await service.enviar();

      expect(r.ok).toBe(true);
      expect(mailer.enviar).toHaveBeenCalledWith(
        ['a@x.com', 'b@x.com'],
        expect.stringContaining('Resumo diário da Implantação'),
        expect.any(String),
      );
      const corpo = mailer.enviar.mock.calls[0][2];
      expect(corpo).toContain('Ativos:');
      expect(corpo).toContain('Documentos obrigatórios pendentes:');
      expect(corpo).toContain('Alertas (1):');
      expect(corpo).toContain('[ALTO] X — Projeto marcado como Em risco');
    });

    it('mostra "Sem alertas" quando não há nenhum', async () => {
      config.get.mockReturnValue('a@x.com');
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: true, erro: null });
      projetosRepo.find.mockResolvedValue([]);

      await service.enviar();

      const corpo = mailer.enviar.mock.calls[0][2];
      expect(corpo).toContain('Sem alertas no momento.');
    });

    it('devolve o erro do mailer quando o envio falha', async () => {
      config.get.mockReturnValue('a@x.com');
      mailer.configurado.mockReturnValue(true);
      mailer.enviar.mockResolvedValue({ ok: false, erro: 'SMTP indisponível' });

      const r = await service.enviar();

      expect(r.ok).toBe(false);
      expect(r.mensagem).toBe('SMTP indisponível');
    });
  });
});
