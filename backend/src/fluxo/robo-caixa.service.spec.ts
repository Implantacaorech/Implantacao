import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { RoboCaixaService } from './robo-caixa.service';
import { ImapIntakeService } from './imap-intake.service';
import { FluxoService } from './fluxo.service';

describe('RoboCaixaService', () => {
  let service: RoboCaixaService;
  const config = { get: jest.fn().mockReturnValue(10) };
  const imap = { configurado: jest.fn(), processarFechamentos: jest.fn() };
  const fluxo = { criarDeFechamento: jest.fn() };
  const scheduler = {
    addInterval: jest.fn(),
    deleteInterval: jest.fn(),
    doesExist: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoboCaixaService,
        { provide: ConfigService, useValue: config },
        { provide: ImapIntakeService, useValue: imap },
        { provide: FluxoService, useValue: fluxo },
        { provide: SchedulerRegistry, useValue: scheduler },
      ],
    }).compile();
    service = module.get(RoboCaixaService);
  });

  describe('tick', () => {
    it('não processa quando o IMAP não está configurado', async () => {
      imap.configurado.mockReturnValue(false);
      await service.tick();
      expect(imap.processarFechamentos).not.toHaveBeenCalled();
    });

    it('processa fechamentos quando configurado, repassando fluxo.criarDeFechamento', async () => {
      imap.configurado.mockReturnValue(true);
      imap.processarFechamentos.mockImplementation(async (criarFn: any) => {
        await criarFn('corpo', 'assunto', 'vendedor@rech.com.br');
        return 1;
      });
      fluxo.criarDeFechamento.mockResolvedValue(42);
      await service.tick();
      expect(imap.processarFechamentos).toHaveBeenCalled();
      // O REMETENTE é repassado: é o comercial que recebe o retorno do levantamento
      // (passo 3), e é gravado em `comercialEmail` na criação da ficha.
      expect(fluxo.criarDeFechamento).toHaveBeenCalledWith(
        'corpo',
        'assunto',
        'vendedor@rech.com.br',
      );
    });

    it('uma falha no tick não propaga', async () => {
      imap.configurado.mockImplementation(() => {
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

    it('registra um intervalo fora de teste', () => {
      process.env.NODE_ENV = 'production';
      service.onModuleInit();
      expect(scheduler.addInterval).toHaveBeenCalledWith(
        'robo-caixa',
        expect.anything(),
      );
      clearInterval(scheduler.addInterval.mock.calls[0][1]);
    });

    it('remove o intervalo registrado ao destruir o módulo', () => {
      scheduler.doesExist.mockReturnValue(true);
      service.onModuleDestroy();
      expect(scheduler.deleteInterval).toHaveBeenCalledWith('robo-caixa');
    });
  });
});
