import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProtocolosService } from './protocolos.service';
import { Protocolo } from '../database/entities/protocolo.entity';

describe('ProtocolosService', () => {
  let service: ProtocolosService;
  let dir: string;

  const repo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) =>
      Promise.resolve({ id: entity.id ?? 1, ...entity }),
    ),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'protocolos-test-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProtocolosService,
        { provide: getRepositoryToken(Protocolo), useValue: repo },
      ],
    }).compile();
    service = module.get(ProtocolosService);
  });

  function arquivo(nome: string, conteudo = 'conteudo de teste'): string {
    const caminho = join(dir, nome);
    writeFileSync(caminho, conteudo);
    return caminho;
  }

  it('hash é determinístico para o mesmo arquivo e muda se o conteúdo muda', () => {
    const a = arquivo('video-a.mp4', 'aaa');
    const b = arquivo('video-b.mp4', 'bbb');
    expect(service.hash(a)).toBe(service.hash(a));
    expect(service.hash(a)).not.toBe(service.hash(b));
  });

  it('criar dedup: o mesmo vídeo (mesmo hash) não gera um segundo registro', async () => {
    const caminho = arquivo('video.mp4');
    repo.findOne.mockResolvedValueOnce(null);
    const r1 = await service.criar('video.mp4', caminho, 'upload', 'Fulano');
    expect(r1.novo).toBe(true);
    expect(repo.save).toHaveBeenCalledTimes(1);

    repo.findOne.mockResolvedValueOnce({
      id: r1.id,
      videoHash: service.hash(caminho),
    });
    const r2 = await service.criar('video.mp4', caminho, 'upload', 'Fulano');
    expect(r2.novo).toBe(false);
    expect(r2.id).toBe(r1.id);
    expect(repo.save).toHaveBeenCalledTimes(1); // não salvou de novo
  });

  it('decidir(true) aprova, registra aprovador/aprovado_em e histórico', async () => {
    const p = { id: 5, historico: '', status: 'Em revisão' } as Protocolo;
    repo.findOne.mockResolvedValue(p);
    const ok = await service.decidir(5, true, 'Ana');
    expect(ok).toBe(true);
    expect(p.status).toBe('Aprovado');
    expect(p.aprovador).toBe('Ana');
    expect(p.aprovadoEm).toBeInstanceOf(Date);
    expect(p.historico).toContain('APROVADO');
  });

  it('decidir(false) reprova e não seta aprovador', async () => {
    const p = { id: 6, historico: '', status: 'Em revisão' } as Protocolo;
    repo.findOne.mockResolvedValue(p);
    await service.decidir(6, false, 'Ana');
    expect(p.status).toBe('Reprovado / Ajustar');
    expect(p.aprovador).toBeUndefined();
  });

  it('salvarEdicao só sobrescreve os campos enviados', async () => {
    const p = {
      id: 7,
      historico: '',
      titulo: 'Antigo',
      resumo: 'Resumo antigo',
    } as Protocolo;
    repo.findOne.mockResolvedValue(p);
    const ok = await service.salvarEdicao(
      7,
      { titulo: '  Novo título  ' },
      'Ana',
    );
    expect(ok).toBe(true);
    expect(p.titulo).toBe('Novo título');
    expect(p.resumo).toBe('Resumo antigo');
  });

  it('atualizarStatus para "Em revisão" registra processado_em', async () => {
    const p = { id: 8, historico: '', status: 'Analisando' } as Protocolo;
    repo.findOne.mockResolvedValue(p);
    await service.atualizarStatus(8, 'Em revisão', undefined, 'robô');
    expect(p.status).toBe('Em revisão');
    expect(p.processadoEm).toBeInstanceOf(Date);
  });

  it('atualizarStatus com erro trunca a mensagem em 2000 caracteres', async () => {
    const p = { id: 9, historico: '', status: 'Transcrevendo' } as Protocolo;
    repo.findOne.mockResolvedValue(p);
    const grande = 'x'.repeat(3000);
    await service.atualizarStatus(9, 'Erro', grande, 'robô');
    expect(p.logErro).toHaveLength(2000);
  });

  describe('excluir', () => {
    it('apaga a linha e devolve o registro (para o controller apagar o arquivo)', async () => {
      const p = {
        id: 10,
        videoCaminho: 'C:\\video.mp4',
        videoNome: 'video.mp4',
      } as Protocolo;
      repo.findOne.mockResolvedValue(p);
      const r = await service.excluir(10);
      expect(r).toBe(p);
      expect(repo.delete).toHaveBeenCalledWith(10);
    });

    it('devolve null e não chama delete se o protocolo não existir', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await service.excluir(999);
      expect(r).toBeNull();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
