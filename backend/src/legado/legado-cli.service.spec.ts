import { EventEmitter } from 'events';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { LegadoCliService } from './legado-cli.service';

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: jest.fn(), end: jest.fn() };
}

const spawnMock = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe('LegadoCliService', () => {
  let service: LegadoCliService;
  const config = { get: jest.fn(() => 'valor-qualquer') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LegadoCliService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(LegadoCliService);
  });

  it('escreve o payload JSON na stdin e resolve com o data do stdout', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);

    const promessa = service.executar('saude', { x: 1 });
    proc.stdout.emit(
      'data',
      Buffer.from('{"ok": true, "data": {"code": 0}}\n'),
    );
    proc.emit('close', 0);

    await expect(promessa).resolves.toEqual({ code: 0 });
    expect(proc.stdin.write).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify({ acao: 'saude', x: 1 }), 'utf8'),
    );
  });

  it('erro reportado pelo CLI (ok:false) vira InternalServerErrorException', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);

    const promessa = service.executar('gerar');
    proc.stdout.emit(
      'data',
      Buffer.from('{"ok": false, "erro": "deu ruim"}\n'),
    );
    proc.emit('close', 1);

    await expect(promessa).rejects.toThrow(InternalServerErrorException);
  });

  it('stdout que não é JSON válido vira InternalServerErrorException', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);

    const promessa = service.executar('saude');
    proc.stdout.emit('data', Buffer.from('isso não é json'));
    proc.emit('close', 1);

    await expect(promessa).rejects.toThrow(InternalServerErrorException);
  });

  it('falha ao iniciar o processo (ex.: python não encontrado) rejeita a promessa', async () => {
    const proc = new FakeProc();
    spawnMock.mockReturnValue(proc);

    const promessa = service.executar('saude');
    proc.emit('error', new Error('ENOENT'));

    await expect(promessa).rejects.toThrow('ENOENT');
  });
});
