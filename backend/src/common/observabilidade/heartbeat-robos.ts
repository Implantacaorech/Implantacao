/**
 * Batimento (heartbeat) dos robôs de fundo — em memória. Achado M6 da auditoria de 2026-08-12:
 * o `SaudeService` detectava ausência só do BACKUP (Tarefa Agendada do Windows). Os robôs que
 * rodam DENTRO do processo — digest diário, caixa IMAP, protocolos do SharePoint — não tinham
 * sinal de vida nenhum: se um `setInterval` morresse (ou o robô travasse num tick), o painel
 * seguia no ar e ninguém sabia que a automação tinha parado. Exatamente o padrão de todo
 * incidente deste projeto: o serviço vivo, a função morta, e o log sem ninguém lendo.
 *
 * Cada robô se REGISTRA no boot (ativo ou desligado, com sua cadência esperada) e BATE a cada
 * tick. O `SaudeService` lê isto e alarma um robô ATIVO que devia ter batido e não bateu —
 * saindo pela tela do Centro de Monitoramento e pelo digest, os mesmos dois canais das outras
 * checagens.
 *
 * SINGLETON DE MÓDULO, como o `contador5xx`, e pela mesma razão: os robôs são serviços de DI,
 * mas o estado precisa ser compartilhado com o `SaudeService` sem acoplá-los, e o cache de
 * módulos do Node garante uma instância só. Estado VOLÁTIL (zera no restart) — adequado: a
 * pergunta é "a automação está viva AGORA?", e o `process.uptime()` dá a folga para não alarmar
 * um robô que ainda não teve tempo de rodar o primeiro ciclo após o boot.
 */
export type StatusBatimento = 'ok' | 'erro';

export interface EstadoRobo {
  chave: string;
  titulo: string;
  /** `false` = desligado de propósito por configuração (ex.: robô da caixa sem
   * MIGRACAO_IMAP_INTAKE_ATIVO). Nesse caso a saúde não cobra batimento. */
  ativo: boolean;
  /** Cadência esperada entre ticks, em ms; `null` para robô sob demanda (sem laço fixo). */
  cadenciaMs: number | null;
  /** epoch ms do último tick, ou `null` se ainda não bateu nesta vida do processo. */
  ultimoEm: number | null;
  ultimoStatus: StatusBatimento;
  ultimoDetalhe: string;
}

class HeartbeatRobos {
  private robos = new Map<string, EstadoRobo>();

  /** O robô declara sua existência no boot. Idempotente e NÃO apaga o último batimento se o
   * robô se re-registrar (só atualiza a definição). */
  registrar(
    chave: string,
    titulo: string,
    ativo: boolean,
    cadenciaMs: number | null,
  ): void {
    const anterior = this.robos.get(chave);
    this.robos.set(chave, {
      chave,
      titulo,
      ativo,
      cadenciaMs,
      ultimoEm: anterior?.ultimoEm ?? null,
      ultimoStatus: anterior?.ultimoStatus ?? 'ok',
      ultimoDetalhe: anterior?.ultimoDetalhe ?? '',
    });
  }

  /** Um tick do robô ocorreu (o laço está vivo). `status: 'erro'` registra que o ciclo rodou
   * mas falhou — a saúde mostra o detalhe sem deixar de contar o robô como "batendo". */
  bater(chave: string, status: StatusBatimento = 'ok', detalhe = ''): void {
    const r = this.robos.get(chave);
    if (r) {
      r.ultimoEm = Date.now();
      r.ultimoStatus = status;
      r.ultimoDetalhe = detalhe;
      return;
    }
    // Bateu sem ter se registrado (robô que só tem tick): cria um registro ativo sem cadência.
    this.robos.set(chave, {
      chave,
      titulo: chave,
      ativo: true,
      cadenciaMs: null,
      ultimoEm: Date.now(),
      ultimoStatus: status,
      ultimoDetalhe: detalhe,
    });
  }

  estado(): EstadoRobo[] {
    return [...this.robos.values()].map((r) => ({ ...r }));
  }

  /** Só para teste — zera o estado entre casos. */
  _resetar(): void {
    this.robos.clear();
  }
}

export const heartbeatRobos = new HeartbeatRobos();

/** Chaves estáveis dos robôs — importadas pelos serviços e pela saúde, para não divergirem. */
export const ROBO_DIGEST = 'digest';
export const ROBO_CAIXA = 'caixa';
export const ROBO_PROTOCOLOS = 'protocolos';
