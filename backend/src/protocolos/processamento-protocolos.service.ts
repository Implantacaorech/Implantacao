import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import { join, resolve, sep } from 'path';
import { AppConfig } from '../config/configuration';
import { ProtocolosService } from './protocolos.service';
import { ProtocoloIaService } from './protocolo-ia.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { EXTS } from './protocolos.constants';
import { montarVocabulario } from './vocabulario';
import { aplicarNomes, lerMapa } from './locutores';

const ESTAVEL_SEG = 90; // arquivo precisa estar sem modificação há N s (OneDrive ainda copiando)
const INTERVALO_POLL_MS = 2000;

/** Quantas consultas seguidas podem voltar "não conheço este trabalho" antes de desistir.
 *
 * O `_jobs` do docservice é memória pura: reiniciando o serviço, o job some e o status passa
 * a responder 404 — que vira `null` aqui. Como `null` não é 'concluido' nem 'erro', a espera
 * girava PARA SEMPRE e o protocolo ficava preso em 'Transcrevendo', estado do qual não há
 * volta (o `processar` recusa reprocessar o que está 'Transcrevendo'/'Analisando').
 *
 * Tolerar algumas respostas vazias cobre a janela entre o POST e o registro do job; passar
 * disso é o docservice tendo perdido o trabalho de verdade. */
const MAX_CONSULTAS_SEM_JOB = 15; // ~30 s

/** Quantas consultas de andamento podem FALHAR seguidas antes de desistir.
 *
 * Diferente do caso acima: aqui o docservice não disse "não conheço" — a conexão em si
 * quebrou (`read ECONNRESET`). Isso acontece sob carga, porque o docservice transcreve um job
 * por vez e vários pipelines ficam consultando o andamento a cada 2 s enquanto uma
 * transcrição pesada monopoliza a máquina.
 *
 * Consultar o andamento é DESCARTÁVEL: falhar nela não diz nada sobre o trabalho em si, que
 * segue rodando do outro lado. Desistir na primeira falha era jogar fora horas de transcrição
 * por um soluço de rede local — foi o que derrubou quatro protocolos em 2026-08-10.
 * 30 tentativas ≈ 1 minuto de indisponibilidade tolerada. */
const MAX_FALHAS_DE_CONSULTA = 30;

/** Tempo máximo que um trabalho JÁ EM ANDAMENTO pode passar sem avançar um segundo sequer.
 *
 * Só vale depois de `pos` passar de zero, e o motivo é importante: o docservice transcreve um
 * job por vez (lock global `_BUSY` em `transcricao/servico.py`), então um job na FILA fica
 * legitimamente com `pos = 0` por horas, esperando o da frente. Cronometrar esse caso mataria
 * trabalho válido. Depois que o progresso começa, ele avança a cada ~2 s — uma hora parado é
 * travamento, não lentidão. */
const MAX_MS_CONGELADO = 60 * 60 * 1000;

/** Pipeline Vídeo -> Protocolo: transcrição local (via docservice) e análise IA. Fluxo:
 * vídeo em 'Videos Pendentes' (ou upload) -> registro Pendente (dedup por hash) ->
 * Transcrevendo -> Analisando -> Em revisão (+ move p/ 'Videos Processados'); qualquer
 * falha -> Erro (+ move p/ 'Videos Com Erro'). Tudo auditado no histórico. Espelha
 * webapp/protocolos.py — a diferença estrutural é que a transcrição em si roda no
 * docservice (Python/faster-whisper); este serviço só orquestra (tem o banco, o
 * docservice não). */
@Injectable()
export class ProcessamentoProtocolosService {
  private readonly logger = new Logger('ProcessamentoProtocolosService');

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly protocolos: ProtocolosService,
    private readonly ia: ProtocoloIaService,
    private readonly transcricao: TranscricaoService,
  ) {}

  pastaRaiz(): string {
    return this.config.get('protocolosDir', { infer: true });
  }

  pasta(nome: string): string {
    return join(this.pastaRaiz(), nome);
  }

  configurado(): boolean {
    return existsSync(this.pasta('Videos Pendentes'));
  }

  private arquivoEstavel(caminho: string): boolean {
    try {
      return (Date.now() - statSync(caminho).mtimeMs) / 1000 >= ESTAVEL_SEG;
    } catch {
      return false;
    }
  }

  /** Registra (status Pendente) os vídeos novos da pasta 'Videos Pendentes'. Dedup por
   * hash — o mesmo vídeo não é registrado duas vezes. Devolve os ids novos. */
  async varrerPasta(responsavel = 'robô'): Promise<number[]> {
    const pend = this.pasta('Videos Pendentes');
    if (!existsSync(pend)) return [];
    const novos: number[] = [];
    const nomes = readdirSync(pend).sort();
    for (const nome of nomes) {
      const lower = nome.toLowerCase();
      if (!EXTS.some((ext) => lower.endsWith(ext))) continue;
      const caminho = join(pend, nome);
      if (!this.arquivoEstavel(caminho)) continue; // pega na próxima varredura
      try {
        const { id, novo } = await this.protocolos.criar(
          nome,
          caminho,
          'sharepoint',
          responsavel,
        );
        if (novo) novos.push(id);
      } catch (e) {
        this.logger.error(
          `Falha ao registrar vídeo ${nome}`,
          e instanceof Error ? e.stack : String(e),
        );
      }
    }
    return novos;
  }

  /** Apaga o arquivo de vídeo/áudio original do disco (chamado pela exclusão do
   * registro). Best-effort: falha aqui não impede a exclusão do registro no banco, só
   * fica no log — o registro é o que importa para o usuário, o arquivo é auxiliar. Mesma
   * trava de segurança do endpoint de streaming (`video()` no controller): só apaga
   * dentro da pasta raiz configurada. */
  apagarArquivo(caminho: string): void {
    if (!caminho) return;
    const alvo = resolve(caminho);
    const raiz = resolve(this.pastaRaiz());
    if (!(alvo === raiz || alvo.startsWith(raiz + sep))) {
      this.logger.warn(
        `Exclusão: arquivo fora da pasta permitida, não apagado (${caminho}).`,
      );
      return;
    }
    try {
      if (existsSync(alvo)) unlinkSync(alvo);
    } catch (e) {
      this.logger.error(
        `Falha ao apagar arquivo ${caminho}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  /** Move o vídeo para a pasta de destino (Processados/Com Erro) e atualiza o caminho. */
  private moverVideo(caminhoAtual: string, destinoNome: string): string | null {
    if (!(caminhoAtual && existsSync(caminhoAtual))) return null;
    const destDir = this.pasta(destinoNome);
    try {
      mkdirSync(destDir, { recursive: true });
      const base = caminhoAtual.split(/[/\\]/).pop() as string;
      const pontoIdx = base.lastIndexOf('.');
      const nomeBase = pontoIdx > 0 ? base.slice(0, pontoIdx) : base;
      const ext = pontoIdx > 0 ? base.slice(pontoIdx) : '';
      let destino = join(destDir, base);
      let n = 1;
      while (existsSync(destino)) {
        // não sobrescreve homônimos
        destino = join(destDir, `${nomeBase}_${n}${ext}`);
        n += 1;
      }
      try {
        renameSync(caminhoAtual, destino);
      } catch (err) {
        // EXDEV (dispositivos diferentes) — rename não funciona entre volumes; cai para
        // copiar+apagar, mesmo fallback do shutil.move original.
        if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
        copyFileSync(caminhoAtual, destino);
        unlinkSync(caminhoAtual);
      }
      return destino;
    } catch (e) {
      this.logger.error(
        `Falha ao mover vídeo de ${caminhoAtual}`,
        e instanceof Error ? e.stack : String(e),
      );
      return null;
    }
  }

  /** Traduz erros comuns da API/pipeline para uma mensagem clara ao usuário. Provedor-agnóstico
   * (Anthropic ou OpenRouter — ver Config → IA), já que a chave pode ser de qualquer um. */
  private erroAmigavel(e: unknown): string {
    const txt =
      e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
    const low = txt.toLowerCase();
    if (low.includes('not a valid model') || low.includes('model not found')) {
      return (
        'Modelo de IA inválido para o provedor escolhido — confira em Config → IA. ' +
        'No OpenRouter o modelo precisa do prefixo do provedor (ex.: anthropic/claude-sonnet-4), ' +
        'não o id "puro" da Anthropic. Depois clique em Processar agora (a transcrição já feita será aproveitada).'
      );
    }
    if (
      low.includes('credit balance is too low') ||
      low.includes('insufficient credits') ||
      low.includes('402')
    ) {
      return (
        'Créditos da API de IA esgotados no provedor configurado (Config → IA) — recarregue ' +
        'na conta do provedor (Anthropic: console.anthropic.com · OpenRouter: openrouter.ai) e ' +
        'clique em Processar agora. A transcrição já feita será aproveitada (não transcreve de novo).'
      );
    }
    if (
      low.includes('authentication') ||
      low.includes('invalid x-api-key') ||
      low.includes('401')
    ) {
      return 'Chave da API de IA inválida — confira em Config → IA.';
    }
    if (low.includes('overloaded') || low.includes('529')) {
      return 'API de IA sobrecarregada no momento — tente Processar agora em alguns minutos.';
    }
    return txt;
  }

  /** Resumo completo da transcrição (2ª chamada de IA). Falha aqui NÃO derruba o
   * pipeline: a análise estruturada já está gravada e o protocolo continua revisável —
   * o revisor vê o aviso no campo e pode usar 'Processar agora' para tentar de novo
   * (a transcrição já feita é aproveitada). */
  private async resumoCompleto(
    transcricao: string,
    videoNome: string,
  ): Promise<string> {
    try {
      return await this.ia.resumirCompleto(transcricao, videoNome);
    } catch (e) {
      this.logger.error(
        `Resumo completo do protocolo "${videoNome}" falhou`,
        e instanceof Error ? e.stack : String(e),
      );
      return `(resumo completo não gerado — ${this.erroAmigavel(e)})`;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Aguarda o job de transcrição do docservice terminar, fazendo polling.
   *
   * Sai por quatro caminhos, e os dois últimos existem para que a espera SEMPRE termine: um
   * laço que só sai em 'concluido'/'erro' deixava o protocolo preso em 'Transcrevendo' para
   * sempre quando o docservice reiniciava no meio — e de lá não há volta pela tela. */
  private async aguardarTranscricao(
    protocoloId: number,
  ): Promise<{ transcricao: string; duracaoSeg: number }> {
    let consultasSemJob = 0;
    let falhasSeguidas = 0;
    let maiorPos = 0;
    let avancouEm = Date.now();

    for (;;) {
      // `status()` lança em qualquer erro que não seja 404. Sem este try, um `ECONNRESET` de
      // um instante -- num serviço em 127.0.0.1! -- derrubava o pipeline e jogava fora horas
      // de transcrição já feita. Aconteceu em produção em 2026-08-10 com quatro protocolos
      // (60, 63, 64 e 65) reprocessados em lote: o docservice transcreve um por vez e, sob
      // carga, parou de responder aos polls por alguns segundos.
      //
      // Consultar o andamento é uma operação DESCARTÁVEL: falhar nela não diz nada sobre o
      // trabalho em si, que segue rodando do outro lado. Só desiste quando as falhas se
      // repetem a ponto de indicar que o serviço caiu de vez.
      let job: Awaited<ReturnType<TranscricaoService['status']>>;
      try {
        job = await this.transcricao.status(protocoloId);
        falhasSeguidas = 0;
      } catch (e) {
        falhasSeguidas += 1;
        if (falhasSeguidas > MAX_FALHAS_DE_CONSULTA) {
          throw new Error(
            'O serviço de transcrição parou de responder durante o processamento ' +
              `(${falhasSeguidas} tentativas seguidas). Último erro: ${this.erroAmigavel(e)}`,
          );
        }
        this.logger.warn(
          `Protocolo ${protocoloId}: consulta de andamento falhou ` +
            `(${falhasSeguidas}/${MAX_FALHAS_DE_CONSULTA}) — segue aguardando. ${this.erroAmigavel(e)}`,
        );
        await this.sleep(INTERVALO_POLL_MS);
        continue;
      }

      if (job?.status === 'concluido') {
        return { transcricao: job.transcricao, duracaoSeg: job.duracaoSeg };
      }
      if (job?.status === 'erro') {
        throw new Error(job.mensagem);
      }

      if (!job) {
        consultasSemJob += 1;
        if (consultasSemJob > MAX_CONSULTAS_SEM_JOB) {
          throw new Error(
            'O serviço de transcrição não conhece mais este trabalho — ele foi ' +
              'reiniciado durante o processamento. É preciso transcrever de novo.',
          );
        }
      } else {
        consultasSemJob = 0;
        if (job.pos > maiorPos) {
          maiorPos = job.pos;
          avancouEm = Date.now();
        } else if (maiorPos > 0 && Date.now() - avancouEm > MAX_MS_CONGELADO) {
          const minutos = Math.round(MAX_MS_CONGELADO / 60000);
          throw new Error(
            `A transcrição parou de avançar há mais de ${minutos} minutos ` +
              `(parada em ${Math.round(maiorPos)}s de áudio) e foi dada como travada.`,
          );
        }
      }

      await this.sleep(INTERVALO_POLL_MS);
    }
  }

  /** Obtém a transcrição do docservice REAPROVEITANDO o que já estiver pronto lá.
   *
   * O resultado concluído fica no `_jobs` do docservice até o processo morrer. Quando a
   * gravação no banco falhava (foi o caso do limite de 64 KB da coluna `transcricao`, em
   * 2026-08-10), o texto continuava ali, inteiro — e ninguém voltava a buscá-lo: reprocessar
   * chamava `iniciar`, que retranscrevia do zero e ainda SOBRESCREVIA o resultado pronto.
   * Horas de CPU jogadas fora por um erro que já tinha sido corrigido.
   *
   * Os três casos:
   *   `concluido`   → reaproveita, sem transcrever nada;
   *   `processando` → acompanha o que já está rodando (chamar `iniciar` aqui daria 409);
   *   `erro`/nada   → começa do zero, que é o comportamento de sempre.
   *
   * O job é indexado pelo id do protocolo e morre junto com o docservice, então reaproveitar
   * não corre o risco de devolver a transcrição de outro vídeo. */
  private async transcreverProtocolo(
    p: {
      videoCaminho: string;
      vocabulario: string;
      cliente: string;
      titulo: string;
      participantes: number;
    },
    id: number,
  ): Promise<{ transcricao: string; duracaoSeg: number }> {
    // Esta consulta é uma OTIMIZAÇÃO (reaproveitar trabalho pronto), não um passo do fluxo.
    // Se ela falhar, o certo é seguir para o `iniciar` — que dará o erro de verdade se o
    // serviço estiver mesmo fora. Deixar a otimização derrubar o pipeline seria trocar um
    // ganho por um risco.
    let jaExistente: Awaited<ReturnType<TranscricaoService['status']>> = null;
    try {
      jaExistente = await this.transcricao.status(id);
    } catch (e) {
      this.logger.warn(
        `Protocolo ${id}: não deu para consultar se já havia transcrição pronta ` +
          `(${this.erroAmigavel(e)}) — seguindo para transcrever.`,
      );
    }

    if (jaExistente?.status === 'concluido') {
      this.logger.log(
        `Protocolo ${id}: reaproveitando a transcrição que já estava pronta no docservice ` +
          `(${jaExistente.transcricao.length} caracteres) — não vai retranscrever.`,
      );
      return {
        transcricao: jaExistente.transcricao,
        duracaoSeg: jaExistente.duracaoSeg,
      };
    }

    if (jaExistente?.status === 'processando') {
      this.logger.log(
        `Protocolo ${id}: já havia transcrição em andamento no docservice — acompanhando ` +
          'em vez de recomeçar.',
      );
    } else {
      // O MESMO vocabulário da gravação vale aqui: a retranscrição do arquivo é onde
      // sai o texto definitivo, então é justamente onde o nome próprio precisa acertar.
      await this.transcricao.iniciar(
        id,
        p.videoCaminho,
        montarVocabulario({
          digitado: p.vocabulario,
          cliente: p.cliente,
          titulo: p.titulo,
        }),
        p.participantes,
      );
    }

    return this.aguardarTranscricao(id);
  }

  /** Roda o pipeline de UM protocolo: transcreve -> analisa -> Em revisão. Se a
   * transcrição JÁ existe (ex.: reprocessando após falha da IA ou edição), ela é
   * APROVEITADA — vai direto para a análise. Em falha, marca Erro e move o vídeo p/
   * 'Videos Com Erro'. Devolve (ok, msg). */
  async processar(
    id: number,
    autor = 'robô',
  ): Promise<{ ok: boolean; msg: string }> {
    const p = await this.protocolos.buscar(id);
    if (!p) return { ok: false, msg: 'Protocolo não encontrado.' };
    if (p.status === 'Transcrevendo' || p.status === 'Analisando') {
      // Trava contra corrida entre chamadores independentes do pipeline: o robô
      // (varredura periódica de 'Pendente') e o disparo direto do upload/"Processar
      // agora" podem, por uma janela de tempo, tentar processar o MESMO id ao mesmo
      // tempo — sem isso, os dois chamam o docservice e o segundo esbarra na trava dele
      // (RuntimeError "já há uma transcrição em andamento"), o que aparecia como um
      // "Erro" confuso na tela. O controller já tinha essa checagem, mas só protegia o
      // clique manual; aqui protege TODOS os chamadores (caso real: protocolos 12/13 em
      // 2026-07-30).
      return { ok: false, msg: 'Já está em processamento.' };
    }

    let texto = (p.transcricao || '').trim();
    if (!texto && !existsSync(p.videoCaminho || '')) {
      await this.protocolos.atualizarStatus(
        id,
        'Erro',
        'Arquivo de vídeo não encontrado.',
        autor,
      );
      return { ok: false, msg: 'Arquivo de vídeo não encontrado.' };
    }

    try {
      if (!texto) {
        // só transcreve se ainda não há transcrição
        await this.protocolos.atualizarStatus(
          id,
          'Transcrevendo',
          undefined,
          autor,
        );
        const t = await this.transcreverProtocolo(p, id);
        await this.protocolos.atualizar(id, {
          transcricao: t.transcricao,
          duracaoSeg: t.duracaoSeg,
        });
        texto = t.transcricao.trim();
        if (!texto) {
          throw new Error('Transcrição vazia (vídeo sem fala reconhecível?).');
        }
      }

      await this.protocolos.atualizarStatus(id, 'Analisando', undefined, autor);
      // A IA lê a transcrição JÁ com os nomes aplicados (quando alguém já renomeou os
      // locutores): "Ivian: ..." em vez de "P1: ..." deixa o resumo distinguir quem é
      // consultor e quem é cliente. O texto gravado segue com os rótulos — ver locutores.ts.
      const atual = await this.protocolos.buscar(id);
      const textoIa = aplicarNomes(texto, lerMapa(atual?.mapaLocutores));
      const { campos, bruto } = await this.ia.analisar(
        textoIa,
        p.videoNome || '',
      );
      await this.protocolos.atualizar(id, { ...campos, textoIa: bruto });
      await this.protocolos.atualizar(id, {
        resumoCompleto: await this.resumoCompleto(textoIa, p.videoNome || ''),
      });

      await this.protocolos.atualizarStatus(id, 'Em revisão', undefined, autor);
      if (p.videoOrigem === 'sharepoint') {
        const novoCaminho = this.moverVideo(
          p.videoCaminho,
          'Videos Processados',
        );
        if (novoCaminho)
          await this.protocolos.atualizar(id, { videoCaminho: novoCaminho });
      }
      return { ok: true, msg: 'Protocolo pronto para revisão.' };
    } catch (e) {
      this.logger.error(
        `Pipeline do protocolo ${id} falhou`,
        e instanceof Error ? e.stack : String(e),
      );
      await this.protocolos.atualizarStatus(
        id,
        'Erro',
        this.erroAmigavel(e),
        autor,
      );
      if (p.videoOrigem === 'sharepoint') {
        const atual = await this.protocolos.buscar(id);
        const novoCaminho = this.moverVideo(
          atual?.videoCaminho ?? p.videoCaminho,
          'Videos Com Erro',
        );
        if (novoCaminho)
          await this.protocolos.atualizar(id, { videoCaminho: novoCaminho });
      }
      return {
        ok: false,
        msg: `Falha no processamento: ${e instanceof Error ? e.constructor.name : 'Error'}`,
      };
    }
  }

  /** Dispara o pipeline de um protocolo em segundo plano (botão 'Processar agora') —
   * não aguarda a conclusão (equivalente a webapp/protocolos.py:processar_async). */
  processarAsync(id: number, autor = ''): void {
    this.processar(id, autor || 'manual').catch((e) => {
      this.logger.error(
        `processarAsync falhou para o protocolo ${id}`,
        e instanceof Error ? e.stack : String(e),
      );
    });
  }

  /** Varre a pasta e processa TODOS os registros Pendentes (sequencial, aguardando cada
   * um terminar). Devolve nº ok. */
  async processarPendentes(autor = 'robô'): Promise<number> {
    await this.varrerPasta(autor);
    const pendentes = await this.protocolos.listar({ status: 'Pendente' });
    let ok = 0;
    for (const p of pendentes.sort(
      (a, b) => a.criadoEm.getTime() - b.criadoEm.getTime(),
    )) {
      const r = await this.processar(p.id, autor);
      if (r.ok) ok += 1;
    }
    return ok;
  }
}
