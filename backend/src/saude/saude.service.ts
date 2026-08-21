import { Injectable, Logger } from '@nestjs/common';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { contador5xx } from '../common/observabilidade/contador-5xx';
import {
  EstadoRobo,
  heartbeatRobos,
} from '../common/observabilidade/heartbeat-robos';
import {
  metricasLatencia,
  ResumoRota,
} from '../common/observabilidade/metricas-latencia';
import { DocserviceSaudeRepository } from './repositories/docservice-saude.repository';
import { OperacaoArquivosRepository } from './repositories/operacao-arquivos.repository';
import { SaudeBancoRepository } from './repositories/saude-banco.repository';

export type NivelSaude = 'ok' | 'aviso' | 'critico' | 'desconhecido';

export interface ItemSaude {
  /** Identificador estável — a tela usa para ícone/link, o digest para ordenar. */
  chave: string;
  titulo: string;
  nivel: NivelSaude;
  /** Uma linha, legível por quem não é técnico. */
  mensagem: string;
  /** O que fazer, ou o número exato. Vazio quando não há o que acrescentar. */
  detalhe: string;
}

export interface ResultadoSaude {
  /** O pior dos itens — é o que colore o cabeçalho e decide se o digest chama atenção. */
  nivel: NivelSaude;
  itens: ItemSaude[];
  verificadoEm: string;
}

/** Idade máxima aceitável do último dump. 48 h e não 24 h: a tarefa roda às 22:00 e a
 * máquina às vezes está desligada nesse horário — reclamar de uma noite perdida geraria
 * ruído diário, e ruído diário é o que faz alarme ser ignorado. Duas noites seguidas sem
 * backup, não. */
const HORAS_BACKUP = 48;
/** Um dump do `painel_novo` passa de 1 MB. Zips de **176 bytes** foram gerados por três dias
 * em 2026-07-27..29 (o `docker exec` falhava e o `Out-File` gravava vazio) enquanto o script
 * logava "ok" — tamanho é o sintoma que denuncia esse caso. */
const BYTES_MIN_BACKUP = 100 * 1024;
/** Reinícios do Guardião em 24 h a partir dos quais isso deixa de ser "uma queda" e passa a
 * ser laço. Em 22/07/2026 ele reiniciou o painel **159 vezes em 13 h** sem que ninguém
 * fosse avisado: o guardião funcionou, o alarme é que não existia. */
const REINICIOS_CRITICOS = 3;

/** Folga antes de cobrar o batimento de um robô: 3× a cadência esperada. Abaixo disso, um tick
 * atrasado é variação normal (a máquina hibernou, um ciclo demorou mais), não uma parada. A
 * mesma folga vale para o começo: recém-subido, o robô ainda não teve tempo de rodar. Achado M6. */
const FATOR_GRACA_ROBO = 3;

const H = 60 * 60 * 1000;

const PIOR: Record<NivelSaude, number> = {
  ok: 0,
  desconhecido: 1,
  aviso: 2,
  critico: 3,
};

/** Vigilância da própria infraestrutura do Painel: banco, backup, Guardião, docservice,
 * transcrições e e-mails.
 *
 * **Por que existe:** todo incidente sério deste projeto passou despercebido por dias, não
 * por falta de log, mas por falta de alguém lendo o log. Backup gravando 176 bytes por três
 * dias com o script dizendo "ok"; quatro dias sem dump nenhum por uma senha obsoleta no
 * ambiente; guardião reiniciando o painel 159 vezes em 13 h. Em todos, o painel continuava
 * no ar e ninguém tinha motivo para desconfiar.
 *
 * Por isso o resultado sai por DOIS canais: a tela do Centro de Monitoramento (para quem
 * olha) e o digest diário (para quem não olha). Um diagnóstico que só existe numa tela
 * repete o defeito original. */
@Injectable()
export class SaudeService {
  private readonly logger = new Logger('SaudeService');

  constructor(
    private readonly arquivos: OperacaoArquivosRepository,
    private readonly banco: SaudeBancoRepository,
    private readonly docservice: DocserviceSaudeRepository,
    private readonly transcricao: TranscricaoService,
  ) {}

  async diagnostico(): Promise<ResultadoSaude> {
    const agora = new Date();
    // Em paralelo: são checagens independentes, e a mais lenta (docservice fora do ar)
    // seguraria as outras numa fila.
    const itens = await Promise.all([
      this.checarBanco(),
      Promise.resolve(this.checarBackup(agora)),
      Promise.resolve(this.checarGuardiao(agora)),
      this.checarDocservice(),
      this.checarTranscricoes(),
      this.checarEmails(agora),
      Promise.resolve(this.checarErros5xx()),
    ]);
    // M6: um item por robô de fundo (digest, caixa, protocolos). Fica DEPOIS das checagens de
    // infraestrutura, na mesma lista — sai pelos dois canais (tela e digest) como o resto.
    const todos = [...itens, ...this.checarRobos()];
    return {
      nivel: todos.reduce<NivelSaude>(
        (pior, i) => (PIOR[i.nivel] > PIOR[pior] ? i.nivel : pior),
        'ok',
      ),
      itens: todos,
      verificadoEm: agora.toISOString(),
    };
  }

  /** Eixo 9: latência por rota (p95/média/máx). Alimentada pelo MetricasInterceptor; usada pela
   * tela de Monitoramento para ver qual rota está degradando antes de virar reclamação. */
  metricas(): ResumoRota[] {
    return metricasLatencia.resumo();
  }

  /** Só o que NÃO está ok, para o digest diário e para o resumo do topo da tela. */
  async problemas(): Promise<ItemSaude[]> {
    const { itens } = await this.diagnostico();
    return itens
      .filter((i) => i.nivel !== 'ok')
      .sort((a, b) => PIOR[b.nivel] - PIOR[a.nivel]);
  }

  // ------------------------------------------------------------------------ checagens

  private async checarBanco(): Promise<ItemSaude> {
    const r = await this.banco.conexaoResponde();
    return {
      chave: 'banco',
      titulo: 'Banco de dados',
      nivel: r.ok ? 'ok' : 'critico',
      mensagem: r.ok
        ? `Conexão respondendo (${r.dialeto}).`
        : 'O banco não respondeu — o painel está inutilizável.',
      detalhe: r.erro,
    };
  }

  /** A12: erros internos (5xx) das últimas 24 h. Enquanto o painel "está no ar", um recurso
   * pode estar quebrando 500 para todo mundo sem ninguém saber — foi o caso da tabela
   * `preferencias_usuario` ausente por 5 min em 30/07. 1+ erro é aviso; um surto (≥ 25) é
   * crítico. O contador é volátil (zera no restart), o que é adequado: interessa "está
   * acontecendo agora?". */
  private checarErros5xx(): ItemSaude {
    const r = contador5xx.resumo();
    const nivel: NivelSaude =
      r.total24h === 0 ? 'ok' : r.total24h >= 25 ? 'critico' : 'aviso';
    return {
      chave: 'erros_5xx',
      titulo: 'Erros internos (5xx)',
      nivel,
      mensagem:
        r.total24h === 0
          ? 'Nenhum erro interno nas últimas 24 h.'
          : `${r.total24h} erro(s) interno(s) nas últimas 24 h.`,
      detalhe: r.ultimo
        ? `Último: ${r.ultimo.status} em ${r.ultimo.rota} (${r.ultimo.em}).`
        : '',
    };
  }

  private checarBackup(agora: Date): ItemSaude {
    const item = (
      nivel: NivelSaude,
      mensagem: string,
      detalhe = '',
    ): ItemSaude => ({
      chave: 'backup',
      titulo: 'Backup do banco',
      nivel,
      mensagem,
      detalhe,
    });

    const ultimo = this.arquivos.ultimoBackup();
    if (!ultimo) {
      return item(
        'critico',
        'Nenhum backup encontrado.',
        `Nada em ${this.arquivos.pasta()} — confira a Tarefa Agendada ` +
          '"Painel Novo — Backup MariaDB".',
      );
    }

    const horas = Math.floor(
      (agora.getTime() - ultimo.modificadoEm.getTime()) / H,
    );
    const quando = `${ultimo.nome} (${this.mb(ultimo.bytes)}, há ${horas} h)`;

    if (ultimo.bytes < BYTES_MIN_BACKUP) {
      // O caso mais traiçoeiro: existe arquivo, a tarefa "rodou", e não há nada dentro.
      return item(
        'critico',
        `O último backup tem só ${this.mb(ultimo.bytes)} — está vazio.`,
        `${quando}. Rode tools/Painel_Novo_Backup_MariaDB.ps1 à mão e leia o log.`,
      );
    }
    if (horas >= HORAS_BACKUP) {
      return item(
        'critico',
        `O último backup é de ${horas} h atrás.`,
        `${quando}. Confira a Tarefa Agendada e ${this.arquivos.pasta()}\\backup_novo_mariadb.log.`,
      );
    }

    const erros = this.arquivos.errosDeBackup(
      new Date(agora.getTime() - 24 * H),
    );
    if (erros.length > 0) {
      // Backup recente E erro no log: alguma execução falhou mesmo com outra tendo salvado.
      return item(
        'aviso',
        `Backup em dia, mas houve ${erros.length} falha(s) registrada(s) nas últimas 24 h.`,
        `${quando}. Último: ${erros[erros.length - 1].slice(0, 200)}`,
      );
    }
    return item('ok', `Backup em dia — ${quando}.`);
  }

  private checarGuardiao(agora: Date): ItemSaude {
    const reinicios = this.arquivos.reiniciosDoGuardiao(
      new Date(agora.getTime() - 24 * H),
    );
    const item = (
      nivel: NivelSaude,
      mensagem: string,
      detalhe = '',
    ): ItemSaude => ({
      chave: 'guardiao',
      titulo: 'Estabilidade (Guardião)',
      nivel,
      mensagem,
      detalhe,
    });

    if (reinicios.length === 0) {
      return item('ok', 'Nenhum reinício nas últimas 24 h.');
    }
    const ultimo = reinicios[reinicios.length - 1];
    const detalhe =
      `Último: ${this.dataHora(ultimo.quando)} — ${ultimo.mensagem} ` +
      `(${this.arquivos.pasta()}\\guardiao_novo.log)`;
    if (reinicios.length >= REINICIOS_CRITICOS) {
      return item(
        'critico',
        `O Guardião reergueu o serviço ${reinicios.length} vezes nas últimas 24 h — ` +
          'algo está derrubando o painel.',
        detalhe,
      );
    }
    return item(
      'aviso',
      `O Guardião reergueu o serviço ${reinicios.length} vez(es) nas últimas 24 h.`,
      detalhe,
    );
  }

  private async checarDocservice(): Promise<ItemSaude> {
    const r = await this.docservice.responde();
    return {
      chave: 'docservice',
      titulo: 'Serviço de documentos e transcrição',
      nivel: r.ok ? 'ok' : 'critico',
      mensagem: r.ok
        ? 'No ar e respondendo.'
        : 'Fora do ar — geração de documentos, transcrição e gravação de reunião não funcionam.',
      detalhe: r.ok ? '' : `${r.detalhe}. Suba com docservice\\iniciar.bat.`,
    };
  }

  /** Protocolo marcado como 'Transcrevendo' cujo trabalho o docservice não conhece está
   * preso — e a única forma de saber isso é perguntando aos dois lados, já que o registro
   * sozinho parece perfeitamente saudável. */
  private async checarTranscricoes(): Promise<ItemSaude> {
    const item = (
      nivel: NivelSaude,
      mensagem: string,
      detalhe = '',
    ): ItemSaude => ({
      chave: 'transcricao',
      titulo: 'Transcrições em andamento',
      nivel,
      mensagem,
      detalhe,
    });

    let emProcessamento: { id: number; status: string; videoNome: string }[];
    try {
      emProcessamento = await this.banco.protocolosEmProcessamento();
    } catch (e) {
      this.logger.warn(
        `Não deu para listar os protocolos em processamento: ${String(e)}`,
      );
      return item(
        'desconhecido',
        'Não foi possível consultar as transcrições.',
      );
    }
    if (emProcessamento.length === 0) {
      return item('ok', 'Nenhuma transcrição em andamento.');
    }

    const presos: string[] = [];
    for (const p of emProcessamento) {
      if (p.status !== 'Transcrevendo') continue; // 'Analisando' não tem job no docservice
      try {
        const job = await this.transcricao.status(p.id);
        if (!job || job.status === 'erro')
          presos.push(`#${p.id} ${p.videoNome}`);
      } catch {
        // Docservice fora do ar já é reportado pela checagem própria; aqui, sem resposta,
        // não dá para afirmar que o trabalho se perdeu.
        return item(
          'desconhecido',
          `${emProcessamento.length} em andamento — sem resposta do serviço de transcrição para conferir.`,
        );
      }
    }

    if (presos.length > 0) {
      return item(
        'aviso',
        `${presos.length} transcrição(ões) presa(s): o registro diz "Transcrevendo", mas ` +
          'não há trabalho rodando.',
        `${presos.join(', ')}. Abra a ficha e use "Cancelar processamento" para destravar.`,
      );
    }
    return item(
      'ok',
      `${emProcessamento.length} transcrição(ões) em andamento, todas com trabalho ativo.`,
    );
  }

  private async checarEmails(agora: Date): Promise<ItemSaude> {
    const item = (
      nivel: NivelSaude,
      mensagem: string,
      detalhe = '',
    ): ItemSaude => ({
      chave: 'email',
      titulo: 'Envio de e-mail',
      nivel,
      mensagem,
      detalhe,
    });
    try {
      const r = await this.banco.emailsQueFalharam(
        new Date(agora.getTime() - 24 * H),
      );
      if (r.total === 0)
        return item('ok', 'Nenhuma falha de envio nas últimas 24 h.');
      return item(
        'aviso',
        `${r.total} e-mail(s) do processo não saíram nas últimas 24 h.`,
        r.ultimoErro
          ? `Último erro: ${r.ultimoErro}`
          : 'Confira Config → E-mail (Microsoft 365).',
      );
    } catch (e) {
      this.logger.warn(
        `Não deu para consultar os e-mails falhos: ${String(e)}`,
      );
      return item('desconhecido', 'Não foi possível consultar os envios.');
    }
  }

  /** M6: sinal de vida dos robôs de fundo (digest, caixa, protocolos). Um robô ATIVO que devia
   * ter batido e não bateu é aviso — foi assim que toda automação deste projeto parou sem
   * ninguém saber (o `setInterval` morria, o painel seguia no ar). Robô DESLIGADO por
   * configuração (ex.: a caixa IMAP, padrão desde 2026-07-27) não é cobrado. A folga do
   * `process.uptime()` evita alarmar um robô que ainda não teve tempo de rodar o primeiro
   * ciclo depois de um restart. */
  private checarRobos(): ItemSaude[] {
    const uptimeMs = process.uptime() * 1000;
    return heartbeatRobos.estado().map((r) => this.itemRobo(r, uptimeMs));
  }

  private itemRobo(r: EstadoRobo, uptimeMs: number): ItemSaude {
    const base = (
      nivel: NivelSaude,
      mensagem: string,
      detalhe = '',
    ): ItemSaude => ({
      chave: `robo_${r.chave}`,
      titulo: r.titulo,
      nivel,
      mensagem,
      detalhe,
    });
    if (!r.ativo) return base('ok', 'Desligado por configuração.');

    const cadencia = r.cadenciaMs ?? 0;
    const graca = cadencia * FATOR_GRACA_ROBO;
    if (r.ultimoEm === null) {
      // Ainda não bateu nesta vida do processo — pode ser cedo demais para cobrar.
      if (cadencia === 0 || uptimeMs < graca) {
        return base(
          'ok',
          `No ar — aguardando o primeiro ciclo (a cada ${this.duracao(cadencia)}).`,
        );
      }
      return base(
        'aviso',
        `Ativo, mas não rodou nenhuma vez desde que o painel subiu (há ${this.duracao(uptimeMs)}).`,
        'O laço do robô pode ter morrido no boot — confira o log do serviço.',
      );
    }

    const idade = Date.now() - r.ultimoEm;
    if (cadencia > 0 && idade > graca) {
      return base(
        'aviso',
        `Sem sinal há ${this.duracao(idade)} (esperado a cada ${this.duracao(cadencia)}) — parou de rodar.`,
        'Confira o log do serviço; um restart do painel reergue os robôs.',
      );
    }
    if (r.ultimoStatus === 'erro') {
      return base(
        'aviso',
        `Rodando, mas o último ciclo falhou (há ${this.duracao(idade)}).`,
        r.ultimoDetalhe,
      );
    }
    return base('ok', `Rodando — último ciclo há ${this.duracao(idade)}.`);
  }

  // ------------------------------------------------------------------------ formatação

  /** "menos de 1 min" / "12 min" / "2 h" / "3 dia(s)" — aproximação legível para não-técnico. */
  private duracao(ms: number): string {
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'menos de 1 min';
    if (min < 60) return `${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `${horas} h`;
    return `${Math.floor(horas / 24)} dia(s)`;
  }

  private mb(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }

  private dataHora(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
