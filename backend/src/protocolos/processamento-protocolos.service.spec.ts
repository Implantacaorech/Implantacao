import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  utimesSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProcessamentoProtocolosService } from './processamento-protocolos.service';
import { ProtocolosService } from './protocolos.service';
import { ProtocoloIaService } from './protocolo-ia.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { Protocolo } from '../database/entities/protocolo.entity';

describe('ProcessamentoProtocolosService', () => {
  let service: ProcessamentoProtocolosService;
  let raiz: string;

  const config = { get: jest.fn() };
  const protocolos = {
    buscar: jest.fn(),
    criar: jest.fn(),
    atualizarStatus: jest.fn(),
    atualizar: jest.fn(),
    listar: jest.fn(),
  };
  const ia = { analisar: jest.fn(), resumirCompleto: jest.fn() };
  const transcricao = { iniciar: jest.fn(), status: jest.fn() };

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'protocolos-raiz-'));
  });

  afterAll(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockReturnValue(raiz);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessamentoProtocolosService,
        { provide: ConfigService, useValue: config },
        { provide: ProtocolosService, useValue: protocolos },
        { provide: ProtocoloIaService, useValue: ia },
        { provide: TranscricaoService, useValue: transcricao },
      ],
    }).compile();
    service = module.get(ProcessamentoProtocolosService);
  });

  function protocolo(over: Partial<Protocolo> = {}): Protocolo {
    return {
      id: 1,
      transcricao: '',
      videoCaminho: join(raiz, 'video.mp4'),
      videoNome: 'video.mp4',
      videoOrigem: 'upload',
      ...over,
    } as Protocolo;
  }

  describe('processar', () => {
    it('vídeo inexistente e sem transcrição -> Erro, sem tentar transcrever', async () => {
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: join(raiz, 'nao-existe.mp4') }),
      );
      const r = await service.processar(1, 'Fulano');
      expect(r.ok).toBe(false);
      expect(protocolos.atualizarStatus).toHaveBeenCalledWith(
        1,
        'Erro',
        'Arquivo de vídeo não encontrado.',
        'Fulano',
      );
      expect(transcricao.iniciar).not.toHaveBeenCalled();
    });

    it('pipeline completo com sucesso (upload não move o arquivo)', async () => {
      const video = join(raiz, 'aula.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, videoOrigem: 'upload' }),
      );
      transcricao.iniciar.mockResolvedValue(undefined);
      transcricao.status.mockResolvedValue({
        status: 'concluido',
        transcricao: '[00:01] fala',
        duracaoSeg: 10,
        idioma: 'pt',
      });
      ia.analisar.mockResolvedValue({
        campos: { modulo: 'Estoque', menu: '1.4-I' },
        bruto: '{"modulo":"Estoque"}',
      });
      ia.resumirCompleto.mockResolvedValue(
        'Registro de Atividades por Menu do Sistema\nMenu 4 – Caixa:\nAção: lançamento manual.',
      );

      const r = await service.processar(1, 'Fulano');
      expect(r.ok).toBe(true);
      expect(protocolos.atualizarStatus).toHaveBeenNthCalledWith(
        1,
        1,
        'Transcrevendo',
        undefined,
        'Fulano',
      );
      expect(protocolos.atualizarStatus).toHaveBeenNthCalledWith(
        2,
        1,
        'Analisando',
        undefined,
        'Fulano',
      );
      expect(protocolos.atualizarStatus).toHaveBeenNthCalledWith(
        3,
        1,
        'Em revisão',
        undefined,
        'Fulano',
      );
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        transcricao: '[00:01] fala',
        duracaoSeg: 10,
      });
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        modulo: 'Estoque',
        menu: '1.4-I',
        textoIa: '{"modulo":"Estoque"}',
      });
      expect(ia.resumirCompleto).toHaveBeenCalledWith(
        '[00:01] fala',
        'video.mp4',
      );
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        resumoCompleto:
          'Registro de Atividades por Menu do Sistema\nMenu 4 – Caixa:\nAção: lançamento manual.',
      });
      expect(existsSync(video)).toBe(true); // upload não é movido
    });

    it('falha no resumo completo não derruba o pipeline (protocolo segue p/ revisão)', async () => {
      const video = join(raiz, 'aula-resumo.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, transcricao: 'já transcrito' }),
      );
      ia.analisar.mockResolvedValue({
        campos: { modulo: 'Fiscal' },
        bruto: '{}',
      });
      ia.resumirCompleto.mockRejectedValue(new Error('overloaded (529)'));

      const r = await service.processar(1, 'Fulano');
      expect(r.ok).toBe(true);
      expect(protocolos.atualizarStatus).toHaveBeenCalledWith(
        1,
        'Em revisão',
        undefined,
        'Fulano',
      );
      const chamada = protocolos.atualizar.mock.calls.find(
        (c: unknown[]) =>
          typeof (c[1] as { resumoCompleto?: string }).resumoCompleto ===
          'string',
      ) as [number, { resumoCompleto: string }];
      expect(chamada[1].resumoCompleto).toContain('resumo completo não gerado');
      expect(chamada[1].resumoCompleto).toContain('sobrecarregada');
    });

    it('transcrição já existente é reaproveitada (não chama a transcrição de novo)', async () => {
      const video = join(raiz, 'aula2.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, transcricao: 'já transcrito' }),
      );
      ia.analisar.mockResolvedValue({
        campos: { modulo: 'Fiscal' },
        bruto: '{}',
      });
      ia.resumirCompleto.mockResolvedValue('resumo');

      const r = await service.processar(1, 'Fulano');
      expect(r.ok).toBe(true);
      expect(transcricao.iniciar).not.toHaveBeenCalled();
      expect(protocolos.atualizarStatus).not.toHaveBeenCalledWith(
        1,
        'Transcrevendo',
        undefined,
        'Fulano',
      );
    });

    it.each(['Transcrevendo', 'Analisando'] as const)(
      'status já "%s" -> não reprocessa (evita corrida robô x upload)',
      async (statusAtual) => {
        protocolos.buscar.mockResolvedValue(protocolo({ status: statusAtual }));

        const r = await service.processar(1, 'robô');
        expect(r).toEqual({ ok: false, msg: 'Já está em processamento.' });
        expect(transcricao.iniciar).not.toHaveBeenCalled();
        expect(ia.analisar).not.toHaveBeenCalled();
        expect(protocolos.atualizarStatus).not.toHaveBeenCalled();
      },
    );

    it('falha na transcrição -> Erro com mensagem amigável e move vídeo sharepoint p/ "Videos Com Erro"', async () => {
      const video = join(raiz, 'aula3.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, videoOrigem: 'sharepoint' }),
      );
      transcricao.iniciar.mockResolvedValue(undefined);
      transcricao.status.mockResolvedValue({
        status: 'erro',
        mensagem: 'RuntimeError: invalid x-api-key fornecida (401)',
      });

      const r = await service.processar(1, 'Fulano');
      expect(r.ok).toBe(false);
      const chamadaErro = protocolos.atualizarStatus.mock.calls.find(
        (c: unknown[]) => c[1] === 'Erro',
      );
      expect(chamadaErro[2]).toBe(
        'Chave da API de IA inválida — confira em Config → IA.',
      );
      expect(existsSync(video)).toBe(false); // foi movido
      expect(existsSync(join(raiz, 'Videos Com Erro', 'aula3.mp4'))).toBe(true);
    });
  });

  describe('varrerPasta', () => {
    it('ignora arquivo instável (mtime recente), extensão não suportada, e faz dedup', async () => {
      const pend = join(raiz, 'Videos Pendentes');
      mkdirSync(pend, { recursive: true });
      const video = join(pend, 'novo.mp4');
      writeFileSync(video, 'conteudo');
      // mtime "agora" -> instável
      const agora = new Date();
      utimesSync(video, agora, agora);
      const txt = join(pend, 'nota.txt');
      writeFileSync(txt, 'não é vídeo');

      const novos1 = await service.varrerPasta('robô');
      expect(novos1).toEqual([]);
      expect(protocolos.criar).not.toHaveBeenCalled();

      // torna o arquivo "estável" (mtime há 91s)
      const antigo = new Date(Date.now() - 91_000);
      utimesSync(video, antigo, antigo);
      protocolos.criar.mockResolvedValue({ id: 42, novo: true });

      const novos2 = await service.varrerPasta('robô');
      expect(novos2).toEqual([42]);
      expect(protocolos.criar).toHaveBeenCalledWith(
        'novo.mp4',
        video,
        'sharepoint',
        'robô',
      );
    });
  });

  describe('configurado', () => {
    it('true quando "Videos Pendentes" existe', () => {
      mkdirSync(join(raiz, 'Videos Pendentes'), {
        recursive: true,
      });
      expect(service.configurado()).toBe(true);
    });

    it('false quando não existe', () => {
      config.get.mockReturnValue(join(raiz, 'pasta-inexistente'));
      expect(service.configurado()).toBe(false);
    });
  });

  describe('apagarArquivo', () => {
    it('apaga o arquivo dentro da pasta raiz', () => {
      const arq = join(raiz, 'apagar.mp4');
      writeFileSync(arq, 'x');
      service.apagarArquivo(arq);
      expect(existsSync(arq)).toBe(false);
    });

    it('não apaga arquivo fora da pasta raiz (mesma trava do streaming)', () => {
      const fora = join(tmpdir(), `fora-${Date.now()}.mp4`);
      writeFileSync(fora, 'x');
      try {
        service.apagarArquivo(fora);
        expect(existsSync(fora)).toBe(true);
      } finally {
        rmSync(fora, { force: true });
      }
    });

    it('caminho vazio ou arquivo já removido não lança', () => {
      expect(() => service.apagarArquivo('')).not.toThrow();
      expect(() =>
        service.apagarArquivo(join(raiz, 'nao-existe-mais.mp4')),
      ).not.toThrow();
    });
  });
});
