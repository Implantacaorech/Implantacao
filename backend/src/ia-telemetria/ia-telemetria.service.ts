import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { StatusExecucaoIa } from '../database/entities/execucao-ia.entity';
import { custoEstimadoUsd } from './precos-ia';
import { ExecucaoIaRepository } from './repositories/execucao-ia.repository';

/** Dados que o IaService entrega ao registrar uma chamada. */
export interface RegistroExecucaoIa {
  finalidade: string;
  provider: string;
  modelo: string;
  solicitante?: string | null;
  contexto?: string;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  duracaoMs: number;
  status: StatusExecucaoIa;
  erro?: string | null;
}

export interface ResumoTelemetriaIa {
  /** Custo estimado de hoje e dos últimos 7 dias, em USD. */
  custoHojeUsd: number;
  custo7diasUsd: number;
  execucoesHoje: number;
  execucoes7dias: number;
  errosHoje: number;
  porFinalidade: {
    finalidade: string;
    execucoes: number;
    tokensEntrada: number;
    tokensSaida: number;
    custoUsd: number;
  }[];
  ultimas: {
    finalidade: string;
    provider: string;
    modelo: string;
    solicitante: string;
    contexto: string;
    tokensEntrada: number | null;
    tokensSaida: number | null;
    custoUsd: number | null;
    status: StatusExecucaoIa;
    criadoEm: string;
  }[];
  teto: {
    /** Teto diário configurado (USD); 0 = desligado. */
    diarioUsd: number;
    /** Já atingido hoje? */
    atingido: boolean;
  };
}

/**
 * Telemetria de IA (A9/A10) — registra cada chamada de `IaService.completar` e responde
 * "quanto se gastou?" e "quem chamou o quê, quando, com qual modelo?".
 *
 * O registro é **best-effort**: telemetria nunca pode derrubar uma chamada de IA (por isso o
 * `registrar` engole o próprio erro). O teto diário, por outro lado, é uma decisão de negócio e
 * pode SIM interromper — mas só quando configurado (`MIGRACAO_IA_TETO_DIARIO_USD > 0`).
 */
@Injectable()
export class IaTelemetriaService {
  private readonly logger = new Logger('IaTelemetriaService');

  constructor(
    private readonly repo: ExecucaoIaRepository,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Registra uma execução. Calcula o custo a partir do usage + tabela de preços. Nunca lança:
   * um erro de telemetria não pode impedir o trabalho de IA. */
  async registrar(r: RegistroExecucaoIa): Promise<void> {
    try {
      const custoUsd = custoEstimadoUsd(
        r.provider,
        r.modelo,
        r.tokensEntrada,
        r.tokensSaida,
      );
      await this.repo.salvar({
        finalidade: r.finalidade,
        provider: r.provider,
        modelo: r.modelo,
        solicitante: r.solicitante ?? null,
        contexto: (r.contexto ?? '').slice(0, 160),
        tokensEntrada: r.tokensEntrada,
        tokensSaida: r.tokensSaida,
        custoUsd,
        duracaoMs: Math.round(r.duracaoMs),
        status: r.status,
        erro: r.erro ? r.erro.slice(0, 400) : null,
      });
    } catch (e) {
      this.logger.warn(
        `Falha ao registrar telemetria de IA (ignorada): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /** Teto diário configurado (USD); 0 = desligado. */
  tetoDiarioUsd(): number {
    return this.config.get('iaTetoDiarioUsd', { infer: true }) ?? 0;
  }

  /** O teto diário já foi atingido? Quando o teto é 0 (desligado), nunca. Best-effort: se a
   * consulta falhar, NÃO bloqueia (não é papel da telemetria derrubar a IA). */
  async tetoAtingido(): Promise<boolean> {
    const teto = this.tetoDiarioUsd();
    if (teto <= 0) return false;
    try {
      return (await this.repo.custoDesde(this.inicioDeHoje())) >= teto;
    } catch {
      return false;
    }
  }

  async resumo(): Promise<ResumoTelemetriaIa> {
    const agora = new Date();
    const inicioHoje = this.inicioDeHoje();
    const inicio7 = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      custoHojeUsd,
      custo7diasUsd,
      execucoesHoje,
      execucoes7dias,
      errosHoje,
      porFinalidade,
      ultimas,
    ] = await Promise.all([
      this.repo.custoEntre(inicioHoje, agora),
      this.repo.custoEntre(inicio7, agora),
      this.repo.contarEntre(inicioHoje, agora),
      this.repo.contarEntre(inicio7, agora),
      this.repo.errosDesde(inicioHoje),
      this.repo.agregarPorFinalidade(inicio7, agora),
      this.repo.ultimas(20),
    ]);

    const teto = this.tetoDiarioUsd();
    return {
      custoHojeUsd: this.arredondar(custoHojeUsd),
      custo7diasUsd: this.arredondar(custo7diasUsd),
      execucoesHoje,
      execucoes7dias,
      errosHoje,
      porFinalidade: porFinalidade.map((f) => ({
        ...f,
        custoUsd: this.arredondar(f.custoUsd),
      })),
      ultimas: ultimas.map((e) => ({
        finalidade: e.finalidade,
        provider: e.provider,
        modelo: e.modelo,
        solicitante: e.solicitante ?? 'robô/sistema',
        contexto: e.contexto,
        tokensEntrada: e.tokensEntrada,
        tokensSaida: e.tokensSaida,
        custoUsd: e.custoUsd,
        status: e.status,
        criadoEm: e.criadoEm.toISOString(),
      })),
      teto: {
        diarioUsd: teto,
        atingido: teto > 0 && custoHojeUsd >= teto,
      },
    };
  }

  private inicioDeHoje(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Custo em USD com 4 casas — o suficiente para chamadas baratas não sumirem em zero.
  private arredondar(v: number): number {
    return Math.round(v * 10000) / 10000;
  }
}
