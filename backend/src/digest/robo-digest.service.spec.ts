import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RoboDigestService } from './robo-digest.service';
import { DigestService } from './digest.service';

describe('RoboDigestService', () => {
  let service: RoboDigestService;
  const config = { get: jest.fn().mockReturnValue(8) };
  const digest = { destinos: jest.fn(), enviar: jest.fn() };
  const scheduler = { addInterval: jest.fn(), deleteInterval: jest.fn(), doesExist: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoboDigestService,
        { provide: ConfigService, useValue: config },
        { provide: DigestService, useValue: digest },
        { provide: SchedulerRegistry, useValue: scheduler },
      ],
    }).compile();
    service = module.get(RoboDigestService);
  });

  describe('tick', () => {
    it('não envia fora da hora configurada', async () => {
      config.get.mockReturnValue((new Date().getHours() + 1) % 24); // hora diferente da atual
      digest.destinos.mockReturnValue(['a@x.com']);
      await service.tick();
      expect(digest.enviar).not.toHaveBeenCalled();
    });

    it('não envia quando não há destinatários, mesmo na hora certa', async () => {
      config.get.mockReturnValue(new Date().getHours());
      digest.destinos.mockReturnValue([]);
      await service.tick();
      expect(digest.enviar).not.toHaveBeenCalled();
    });

    it('envia na hora certa e não envia de novo no mesmo dia', async () => {
      config.get.mockReturnValue(new Date().getHours());
      digest.destinos.mockReturnValue(['a@x.com']);
      digest.enviar.mockResolvedValue({ ok: true, mensagem: 'Enviado.' });

      await service.tick();
      expect(digest.enviar).toHaveBeenCalledTimes(1);

      await service.tick(); // mesmo dia, mesma hora -> não reenvia
      expect(digest.enviar).toHaveBeenCalledTimes(1);
    });

    it('uma falha no tick não propaga (o robô não pode crashar o processo)', async () => {
      config.get.mockImplementation(() => {
        throw new Error('falha inesperada');
      });
      await expect(service.tick()).resolves.toBeUndefined();
    });
  });

  describe('onModuleInit / onModuleDestroy', () => {
    const antigo = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = antigo;
    });

    it('não registra o intervalo em ambiente de teste', () => {
      process.env.NODE_ENV = 'test';
      service.onModuleInit();
      expect(scheduler.addInterval).not.toHaveBeenCalled();
    });

    it('registra um intervalo de checagem fora de teste', () => {
      process.env.NODE_ENV = 'production';
      service.onModuleInit();
      expect(scheduler.addInterval).toHaveBeenCalledWith('robo-digest', expect.anything());
      const intervalo = scheduler.addInterval.mock.calls[0][1];
      clearInterval(intervalo);
    });

    it('remove o intervalo registrado ao destruir o módulo', () => {
      scheduler.doesExist.mockReturnValue(true);
      service.onModuleDestroy();
      expect(scheduler.deleteInterval).toHaveBeenCalledWith('robo-digest');
    });
  });
});
