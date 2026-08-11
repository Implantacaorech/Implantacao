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
import { MenusSigerService } from '../matriz-detalhada/menus-siger.service';
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
  const transcricao = {
    iniciar: jest.fn(),
    status: jest.fn(),
    cancelar: jest.fn(),
  };
  // Taxonomia de menus do SIGER (Dicionário). Vazia por padrão: o reconhecimento de menus é
  // ENRIQUECIMENTO, e o pipeline tem de funcionar igual sem ele.
  const menus = { taxonomia: jest.fn().mockResolvedValue([]) };

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'protocolos-raiz-'));
  });

  afterAll(() => {
    rmSync(raiz, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    menus.taxonomia.mockResolvedValue([]);
    config.get.mockReturnValue(raiz);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessamentoProtocolosService,
        { provide: ConfigService, useValue: config },
        { provide: ProtocolosService, useValue: protocolos },
        { provide: ProtocoloIaService, useValue: ia },
        { provide: TranscricaoService, useValue: transcricao },
        { provide: MenusSigerService, useValue: menus },
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
      // `null` na 1ª consulta = docservice ainda não conhece este protocolo, que é o estado
      // real de quem nunca foi transcrito. Sem isso o pipeline acharia trabalho pronto e
      // REAPROVEITARIA (ver "reaproveitamento do trabalho do docservice" mais abaixo) — o
      // teste passaria sem nunca exercitar a transcrição de verdade.
      transcricao.status.mockResolvedValueOnce(null).mockResolvedValue({
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
      expect(transcricao.iniciar).toHaveBeenCalled(); // transcreveu de fato
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

    /** A queixa de 2026-08-11: "não trouxe os menus de uso mencionados no vídeo". O prompt
     * já pedia os menus; o que faltava era o código chegar íntegro ao texto. Agora a
     * transcrição é casada contra o catálogo real do Dicionário e a IA recebe a lista. */
    it('entrega à IA os menus do SIGER reconhecidos na transcrição', async () => {
      const video = join(raiz, 'com-menus.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({
          videoCaminho: video,
          // Como o Whisper realmente escreve: o código falado por extenso.
          transcricao: 'Abrimos o dois ponto três N para emitir a nota fiscal.',
        }),
      );
      menus.taxonomia.mockResolvedValue([
        {
          sigla: 'FAT',
          tipo: 'modulo',
          titulo: 'FAT - Faturamento',
          menus: [
            {
              codigo: '2.3-N/G/K',
              opcao: 'Emissao de notas.',
              programa: 'FAT203',
              funcao: '',
            },
          ],
        },
      ]);
      ia.analisar.mockResolvedValue({ campos: {}, bruto: '{}' });
      ia.resumirCompleto.mockResolvedValue('resumo');

      await service.processar(1, 'Fulano');

      const [, , menusNoPrompt] = ia.analisar.mock.calls[0] as [
        string,
        string,
        string,
      ];
      expect(menusNoPrompt).toContain('2.3-N/G/K');
      expect(menusNoPrompt).toContain('FAT203');
    });

    it('Dicionário indisponível não derruba o pipeline — é enriquecimento', async () => {
      const video = join(raiz, 'sem-dicionario.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, transcricao: 'texto qualquer' }),
      );
      menus.taxonomia.mockRejectedValue(new Error('banco fora'));
      ia.analisar.mockResolvedValue({ campos: {}, bruto: '{}' });
      ia.resumirCompleto.mockResolvedValue('resumo');

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(true);
      const [, , menusNoPrompt] = ia.analisar.mock.calls[0] as [
        string,
        string,
        string,
      ];
      expect(menusNoPrompt).toBe(''); // segue sem a lista, como antes
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

  /** O resultado concluído fica no `_jobs` do docservice até o processo morrer. Quando a
   * gravação no banco falhava — foi o caso do limite de 64 KB da coluna `transcricao`, em
   * 2026-08-10 —, o texto continuava lá inteiro e ninguém voltava a buscá-lo: reprocessar
   * retranscrevia do zero e ainda sobrescrevia o resultado pronto. */
  describe('processar — reaproveitamento do trabalho do docservice', () => {
    /** Deixa o pipeline pronto para chegar até a transcrição e terminar bem depois dela. */
    function videoPendente(nome: string) {
      const video = join(raiz, nome);
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, videoOrigem: 'upload' }),
      );
      ia.analisar.mockResolvedValue({ campos: {}, bruto: '{}' });
      ia.resumirCompleto.mockResolvedValue('resumo');
      return video;
    }

    it('job JÁ concluído é reaproveitado — não retranscreve', async () => {
      videoPendente('reaproveita.mp4');
      transcricao.status.mockResolvedValue({
        status: 'concluido',
        transcricao: '[00:01] texto que sobreviveu',
        duracaoSeg: 7200,
        idioma: 'pt',
      });

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(true);
      expect(transcricao.iniciar).not.toHaveBeenCalled();
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        transcricao: '[00:01] texto que sobreviveu',
        duracaoSeg: 7200,
      });
    });

    it('job em andamento é ACOMPANHADO, não recomeçado (chamar iniciar daria 409)', async () => {
      videoPendente('em-andamento.mp4');
      transcricao.status
        .mockResolvedValueOnce({
          status: 'processando',
          pct: 10,
          pos: 60,
          dur: 600,
        })
        .mockResolvedValue({
          status: 'concluido',
          transcricao: '[00:01] fala',
          duracaoSeg: 600,
          idioma: 'pt',
        });
      jest
        .spyOn(service as unknown as { sleep: () => Promise<void> }, 'sleep')
        .mockResolvedValue(undefined);

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(true);
      expect(transcricao.iniciar).not.toHaveBeenCalled();
    });

    it.each([
      ['sem job nenhum', null],
      [
        'job de uma tentativa que falhou',
        { status: 'erro', mensagem: 'RuntimeError: falhou antes' },
      ],
    ])('%s -> transcreve do zero', async (_caso, primeiro) => {
      videoPendente('do-zero.mp4');
      transcricao.iniciar.mockResolvedValue(undefined);
      transcricao.status.mockResolvedValueOnce(primeiro).mockResolvedValue({
        status: 'concluido',
        transcricao: '[00:01] fala',
        duracaoSeg: 10,
        idioma: 'pt',
      });

      await service.processar(1, 'Fulano');

      expect(transcricao.iniciar).toHaveBeenCalled();
    });
  });

  /** A espera precisa SEMPRE terminar. Um laço que só saía em 'concluido'/'erro' deixava o
   * protocolo preso em 'Transcrevendo' para sempre quando o docservice reiniciava no meio —
   * e de 'Transcrevendo' não há volta pela tela, porque `processar` recusa reprocessar. */
  describe('processar — a espera da transcrição não pode girar para sempre', () => {
    /** Sem espera real entre as consultas, e com o relógio sob controle do teste. */
    function relogioControlado() {
      jest
        .spyOn(service as unknown as { sleep: () => Promise<void> }, 'sleep')
        .mockResolvedValue(undefined);
      let agora = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => agora);
      return { avancarMin: (min: number) => (agora += min * 60_000) };
    }

    function videoPendente(nome: string) {
      const video = join(raiz, nome);
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, videoOrigem: 'upload' }),
      );
      transcricao.iniciar.mockResolvedValue(undefined);
    }

    afterEach(() => jest.restoreAllMocks());

    /** Um soluço de rede não pode custar horas de transcrição. O `status()` lança em qualquer
     * erro que não seja 404, e sem tolerância um `ECONNRESET` — num serviço em 127.0.0.1! —
     * derrubava o pipeline inteiro. Aconteceu em produção em 2026-08-10 com quatro protocolos
     * reprocessados em lote: o docservice transcreve um por vez e, sob carga, parou de
     * responder aos polls por alguns segundos. */
    it('falha passageira na consulta NÃO derruba o pipeline — segue aguardando', async () => {
      videoPendente('econnreset.mp4');
      relogioControlado();
      ia.analisar.mockResolvedValue({ campos: {}, bruto: '{}' });
      ia.resumirCompleto.mockResolvedValue('resumo');

      let n = 0;
      transcricao.status.mockImplementation(() => {
        n += 1;
        // Cinco quedas seguidas no meio do caminho, como sob carga.
        if (n >= 2 && n <= 6) {
          return Promise.reject(
            new Error('Serviço de transcrição indisponível: read ECONNRESET'),
          );
        }
        if (n === 1) {
          return Promise.resolve({
            status: 'processando',
            pct: 10,
            pos: 60,
            dur: 600,
          });
        }
        return Promise.resolve({
          status: 'concluido',
          transcricao: '[00:01] sobreviveu ao ECONNRESET',
          duracaoSeg: 600,
          idioma: 'pt',
        });
      });

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(true);
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        transcricao: '[00:01] sobreviveu ao ECONNRESET',
        duracaoSeg: 600,
      });
    });

    it('serviço fora do ar de vez -> desiste com mensagem que diz o que houve', async () => {
      videoPendente('fora-do-ar.mp4');
      relogioControlado();
      transcricao.status.mockRejectedValue(
        new Error('Serviço de transcrição indisponível: read ECONNRESET'),
      );

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(false);
      const erro = protocolos.atualizarStatus.mock.calls.find(
        (c: unknown[]) => c[1] === 'Erro',
      ) as [number, string, string, string];
      expect(erro[2]).toContain('parou de responder');
      expect(erro[2]).toContain('ECONNRESET');
      // Não ficou tentando para sempre.
      expect(transcricao.status.mock.calls.length).toBeLessThan(40);
    });

    it('docservice reiniciado (status some) -> termina em Erro em vez de girar sem fim', async () => {
      videoPendente('sumiu.mp4');
      // Depois do `iniciar`, o job existia; o serviço reiniciou e passou a responder 404.
      transcricao.status.mockResolvedValue(null);
      relogioControlado();

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(false);
      const erro = protocolos.atualizarStatus.mock.calls.find(
        (c: unknown[]) => c[1] === 'Erro',
      ) as [number, string, string, string];
      expect(erro[2]).toContain('não conhece mais este trabalho');
      // Não ficou consultando para sempre: desistiu perto do limite configurado.
      expect(transcricao.status.mock.calls.length).toBeLessThan(25);
    });

    it('trabalho que avançou e depois congelou -> dado como travado', async () => {
      videoPendente('congelou.mp4');
      const relogio = relogioControlado();
      // `pos` sobe uma vez e nunca mais; o relógio anda 10 min a cada consulta.
      transcricao.status
        .mockResolvedValueOnce({
          status: 'processando',
          pct: 5,
          pos: 120,
          dur: 7200,
        })
        .mockImplementation(() => {
          relogio.avancarMin(10);
          return Promise.resolve({
            status: 'processando',
            pct: 5,
            pos: 120,
            dur: 7200,
          });
        });

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(false);
      const erro = protocolos.atualizarStatus.mock.calls.find(
        (c: unknown[]) => c[1] === 'Erro',
      ) as [number, string, string, string];
      expect(erro[2]).toContain('parou de avançar');
      expect(erro[2]).toContain('120s de áudio');
    });

    it('job ESPERANDO NA FILA (pos=0 por horas) NÃO é dado como travado', async () => {
      // O docservice transcreve um job por vez (lock global `_BUSY`): quem está na fila fica
      // legitimamente com pos=0 enquanto o da frente roda. Se a detecção de travamento
      // olhasse o relógio sem olhar o `pos`, mataria trabalho perfeitamente válido.
      videoPendente('na-fila.mp4');
      const relogio = relogioControlado();
      ia.analisar.mockResolvedValue({ campos: {}, bruto: '{}' });
      ia.resumirCompleto.mockResolvedValue('resumo');

      let consultas = 0;
      transcricao.status.mockImplementation(() => {
        relogio.avancarMin(30); // 30 consultas => 15 horas na fila
        consultas += 1;
        if (consultas <= 30) {
          return Promise.resolve({
            status: 'processando',
            pct: null,
            pos: 0,
            dur: 0,
          });
        }
        return Promise.resolve({
          status: 'concluido',
          transcricao: '[00:01] finalmente',
          duracaoSeg: 60,
          idioma: 'pt',
        });
      });

      const r = await service.processar(1, 'Fulano');

      expect(r.ok).toBe(true);
      expect(protocolos.atualizar).toHaveBeenCalledWith(1, {
        transcricao: '[00:01] finalmente',
        duracaoSeg: 60,
      });
    });
  });

  /** 'Transcrevendo'/'Analisando' era um beco sem saída: a trava que evita corrida entre o
   * robô e o clique manual é a MESMA que impedia o conserto, então só se saía mexendo no
   * banco à mão. Na prática isso significava que reiniciar o backend com transcrição em voo
   * deixava o registro preso para sempre. */
  describe('cancelar — destravar o que estava preso em processamento', () => {
    function relogioControlado() {
      jest
        .spyOn(service as unknown as { sleep: () => Promise<void> }, 'sleep')
        .mockResolvedValue(undefined);
    }

    afterEach(() => jest.restoreAllMocks());

    it.each(['Transcrevendo', 'Analisando'] as const)(
      'de "%s" -> mata a transcrição no docservice e devolve para Erro (reprocessável)',
      async (statusAtual) => {
        protocolos.buscar.mockResolvedValue(protocolo({ status: statusAtual }));

        const r = await service.cancelar(1, 'Fulano');

        expect(r.ok).toBe(true);
        expect(transcricao.cancelar).toHaveBeenCalledWith(1);
        const [, status, msg, autor] = protocolos.atualizarStatus.mock
          .calls[0] as [number, string, string, string];
        // 'Erro' é o único status de onde "Processar agora" volta a funcionar — e o
        // reprocessamento aproveita o que já estiver pronto no docservice.
        expect(status).toBe('Erro');
        expect(msg).toContain('cancelado por Fulano');
        expect(autor).toBe('Fulano');
      },
    );

    it.each(['Pendente', 'Em revisão', 'Aprovado', 'Erro'] as const)(
      'status "%s" não tem o que cancelar — não mexe no registro',
      async (statusAtual) => {
        protocolos.buscar.mockResolvedValue(protocolo({ status: statusAtual }));

        const r = await service.cancelar(1, 'Fulano');

        expect(r.ok).toBe(false);
        expect(transcricao.cancelar).not.toHaveBeenCalled();
        expect(protocolos.atualizarStatus).not.toHaveBeenCalled();
      },
    );

    /** Cancelar não pode virar "falha no processamento": a mensagem que a tela mostra é a de
     * quem cancelou, e o vídeo não pode ir para 'Videos Com Erro' — não há defeito nenhum
     * nele, e a varredura deixaria de vê-lo. */
    it('pipeline em voo desiste na batida seguinte, sem sobrescrever a mensagem', async () => {
      const video = join(raiz, 'cancelado-no-meio.mp4');
      writeFileSync(video, 'x');
      protocolos.buscar.mockResolvedValue(
        protocolo({ videoCaminho: video, videoOrigem: 'sharepoint' }),
      );
      relogioControlado();

      let n = 0;
      transcricao.status.mockImplementation(async () => {
        n += 1;
        // Na 2ª consulta (já dentro da espera) alguém clica em Cancelar.
        if (n === 2) await service.interromper(1);
        return { status: 'processando', pct: 10, pos: 60, dur: 600 };
      });

      const r = await service.processar(1, 'Fulano');

      expect(r).toEqual({ ok: false, msg: 'Processamento cancelado.' });
      expect(transcricao.cancelar).toHaveBeenCalledWith(1);
      expect(protocolos.atualizarStatus).not.toHaveBeenCalledWith(
        1,
        'Erro',
        expect.anything(),
        expect.anything(),
      );
      expect(existsSync(video)).toBe(true); // não foi para 'Videos Com Erro'
      expect(ia.analisar).not.toHaveBeenCalled();
    });

    /** É o caminho da EXCLUSÃO: o registro vai embora, então não há status para atualizar —
     * mas o subprocesso do docservice precisa morrer do mesmo jeito. Sem isso, excluir um
     * protocolo em processamento deixava o transcritor moendo o vídeo inteiro (377% de CPU
     * em 2026-08-06) para entregar o resultado a um registro que não existe mais. */
    it('interromper mata a transcrição sem tocar no status', async () => {
      await service.interromper(7);

      expect(transcricao.cancelar).toHaveBeenCalledWith(7);
      expect(protocolos.atualizarStatus).not.toHaveBeenCalled();
    });
  });

  /** O pipeline vive na memória DESTE processo: reiniciar o backend mata a espera, mas o
   * banco continua marcando 'Transcrevendo'/'Analisando' — e desse estado nada saía sozinho. */
  describe('recuperarPresos — o painel reiniciou no meio do processamento', () => {
    function presos(porStatus: Record<string, Partial<Protocolo>[]>) {
      protocolos.listar.mockImplementation(({ status }: { status: string }) =>
        Promise.resolve((porStatus[status] ?? []).map((p) => protocolo(p))),
      );
      return jest
        .spyOn(service, 'processarAsync')
        .mockImplementation(() => undefined);
    }

    afterEach(() => jest.restoreAllMocks());

    it('transcrição já gravada no banco -> retoma sozinho (a IA é barata perto dela)', async () => {
      const async_ = presos({
        Analisando: [{ id: 5, status: 'Analisando', transcricao: '[00:01] x' }],
      });

      const r = await service.recuperarPresos();

      expect(r).toEqual({ retomados: 1, parados: 0 });
      // Precisa passar por 'Erro' ANTES: `processar` recusa quem está em 'Analisando' — é a
      // mesma trava que criou o beco sem saída.
      expect(protocolos.atualizarStatus).toHaveBeenCalledWith(
        5,
        'Erro',
        expect.stringContaining('retomando de onde parou'),
        'sistema',
      );
      expect(async_).toHaveBeenCalledWith(5, 'sistema');
      // Nem consultou o docservice: o texto já está no banco.
      expect(transcricao.status).not.toHaveBeenCalled();
    });

    it('resultado pronto no docservice -> retoma e aproveita', async () => {
      const async_ = presos({
        Transcrevendo: [{ id: 6, status: 'Transcrevendo' }],
      });
      transcricao.status.mockResolvedValue({
        status: 'concluido',
        transcricao: '[00:01] sobreviveu',
        duracaoSeg: 10,
        idioma: 'pt',
      });

      const r = await service.recuperarPresos();

      expect(r).toEqual({ retomados: 1, parados: 0 });
      expect(async_).toHaveBeenCalledWith(6, 'sistema');
    });

    /** A regra que governa a retomada: nunca retranscrever do zero por conta própria. Um
     * vídeo de treinamento leva HORAS de CPU, e um boot que resolvesse recomeçar meia dúzia
     * deles ocuparia a máquina o dia inteiro sem ninguém ter pedido. */
    it.each([
      ['docservice perdeu o job', null],
      ['job terminou em erro', { status: 'erro', mensagem: 'RuntimeError: x' }],
    ])('%s -> para em Erro e NÃO retranscreve sozinho', async (_caso, job) => {
      const async_ = presos({
        Transcrevendo: [{ id: 7, status: 'Transcrevendo' }],
      });
      transcricao.status.mockResolvedValue(job);

      const r = await service.recuperarPresos();

      expect(r).toEqual({ retomados: 0, parados: 1 });
      expect(protocolos.atualizarStatus).toHaveBeenCalledWith(
        7,
        'Erro',
        expect.stringContaining('Processar agora'),
        'sistema',
      );
      expect(async_).not.toHaveBeenCalled();
    });

    /** O docservice sobe em processo próprio e o painel não espera por ele — no boot ele
     * pode simplesmente não estar de pé ainda. */
    it('docservice fora do ar no boot não derruba a varredura', async () => {
      presos({ Transcrevendo: [{ id: 8, status: 'Transcrevendo' }] });
      transcricao.status.mockRejectedValue(new Error('ECONNREFUSED'));

      const r = await service.recuperarPresos();

      expect(r).toEqual({ retomados: 0, parados: 1 });
    });

    it('nada preso -> não escreve nada', async () => {
      presos({});

      const r = await service.recuperarPresos();

      expect(r).toEqual({ retomados: 0, parados: 0 });
      expect(protocolos.atualizarStatus).not.toHaveBeenCalled();
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
