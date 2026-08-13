import { ConfigService } from '@nestjs/config';
import { IaTelemetriaService } from './ia-telemetria.service';
import { ExecucaoIaRepository } from './repositories/execucao-ia.repository';

describe('IaTelemetriaService', () => {
  let service: IaTelemetriaService;
  const repo = {
    salvar: jest.fn(),
    custoDesde: jest.fn(),
    custoEntre: jest.fn(),
    contarEntre: jest.fn(),
    errosDesde: jest.fn(),
    agregarPorFinalidade: jest.fn(),
    ultimas: jest.fn(),
  };
  let teto = 0;
  const config = {
    get: jest.fn(() => teto),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    teto = 0;
    service = new IaTelemetriaService(
      repo as unknown as ExecucaoIaRepository,
      config,
    );
  });

  describe('registrar', () => {
    it('calcula o custo pelo modelo e persiste os metadados', async () => {
      await service.registrar({
        finalidade: 'dicionario',
        provider: 'openrouter',
        modelo: 'openai/gpt-4o-mini',
        solicitante: 'Ana',
        contexto: 'dicionário',
        tokensEntrada: 1_000_000,
        tokensSaida: 1_000_000,
        duracaoMs: 1234,
        status: 'ok',
      });
      expect(repo.salvar).toHaveBeenCalledTimes(1);
      const arg = repo.salvar.mock.calls[0][0];
      expect(arg.custoUsd).toBeCloseTo(0.75, 6);
      expect(arg.solicitante).toBe('Ana');
      expect(arg.status).toBe('ok');
    });

    it('modelo desconhecido → custo null, mas ainda registra', async () => {
      await service.registrar({
        finalidade: 'protocolos',
        provider: 'openrouter',
        modelo: 'x/desconhecido',
        tokensEntrada: 100,
        tokensSaida: 100,
        duracaoMs: 10,
        status: 'ok',
      });
      expect(repo.salvar.mock.calls[0][0].custoUsd).toBeNull();
    });

    it('nunca lança — um erro de telemetria não pode derrubar a IA', async () => {
      repo.salvar.mockRejectedValueOnce(new Error('banco fora'));
      await expect(
        service.registrar({
          finalidade: 'protocolos',
          provider: 'local',
          modelo: 'qwen',
          tokensEntrada: null,
          tokensSaida: null,
          duracaoMs: 5,
          status: 'ok',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('tetoAtingido', () => {
    it('teto 0 (desligado) nunca atinge', async () => {
      teto = 0;
      expect(await service.tetoAtingido()).toBe(false);
      expect(repo.custoDesde).not.toHaveBeenCalled();
    });

    it('atinge quando o gasto de hoje >= teto', async () => {
      teto = 10;
      repo.custoDesde.mockResolvedValue(10.5);
      expect(await service.tetoAtingido()).toBe(true);
    });

    it('não atinge quando o gasto de hoje < teto', async () => {
      teto = 10;
      repo.custoDesde.mockResolvedValue(3);
      expect(await service.tetoAtingido()).toBe(false);
    });

    it('falha na consulta NÃO bloqueia (não é papel da telemetria derrubar a IA)', async () => {
      teto = 10;
      repo.custoDesde.mockRejectedValue(new Error('banco fora'));
      expect(await service.tetoAtingido()).toBe(false);
    });
  });

  describe('resumo', () => {
    it('agrega custo, execuções, erros e marca o teto', async () => {
      teto = 5;
      repo.custoEntre.mockResolvedValueOnce(2).mockResolvedValueOnce(9); // hoje, 7 dias
      repo.contarEntre.mockResolvedValueOnce(3).mockResolvedValueOnce(20);
      repo.errosDesde.mockResolvedValue(1);
      repo.agregarPorFinalidade.mockResolvedValue([
        {
          finalidade: 'protocolos',
          execucoes: 2,
          tokensEntrada: 10,
          tokensSaida: 5,
          custoUsd: 1.5,
        },
      ]);
      repo.ultimas.mockResolvedValue([]);

      const r = await service.resumo();
      expect(r.custoHojeUsd).toBe(2);
      expect(r.custo7diasUsd).toBe(9);
      expect(r.execucoesHoje).toBe(3);
      expect(r.errosHoje).toBe(1);
      expect(r.teto).toEqual({ diarioUsd: 5, atingido: false });
    });
  });
});
