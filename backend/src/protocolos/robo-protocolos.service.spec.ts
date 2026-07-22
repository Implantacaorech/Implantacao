import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RoboProtocolosService } from './robo-protocolos.service';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';

describe('RoboProtocolosService', () => {
  let service: RoboProtocolosService;
  const config = { get: jest.fn().mockReturnValue(10) };
  const processamento = {
    configurado: jest.fn(),
    processarPendentes: jest.fn(),
  };
  const scheduler = {
    addInterval: jest.fn(),
    deleteInterval: jest.fn(),
    doesExist: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoboProtocolosService,
        { provide: ConfigService, useValue: config },
        { provide: ProcessamentoProtocolosService, useValue: processamento },
        { provide: SchedulerRegistry, useValue: scheduler },
      ],
    }).compile();
    service = module.get(RoboProtocolosService);
  });

  describe('tick', () => {
    it('não processa quando a pasta não está configurada', async () => {
      processamento.configurado.mockReturnValue(false);
      await service.tick();
      expect(processamento.processarPendentes).not.toHaveBeenCalled();
    });

    it('processa pendentes quando a pasta está configurada', async () => {
      processamento.configurado.mockReturnValue(true);
      processamento.processarPendentes.mockResolvedValue(3);
      await service.tick();
      expect(processamento.processarPendentes).toHaveBeenCalled();
    });

    it('uma falha no tick não propaga (o robô não pode crashar o processo)', async () => {
      processamento.configurado.mockImplementation(() => {
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

    it('registra um intervalo com piso de 2 minutos fora de teste', () => {
      process.env.NODE_ENV = 'production';
      service.onModuleInit();
      expect(scheduler.addInterval).toHaveBeenCalledWith(
        'robo-protocolos',
        expect.anything(),
      );
      const intervalo = scheduler.addInterval.mock.calls[0][1];
      clearInterval(intervalo); // evita handle pendurado no processo do teste
    });

    it('remove o intervalo registrado ao destruir o módulo', () => {
      scheduler.doesExist.mockReturnValue(true);
      service.onModuleDestroy();
      expect(scheduler.deleteInterval).toHaveBeenCalledWith('robo-protocolos');
    });
  });
});
