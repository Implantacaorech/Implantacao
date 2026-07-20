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
import { join } from 'path';
import { AppConfig } from '../config/configuration';
import { ProtocolosService } from './protocolos.service';
import { ProtocoloIaService } from './protocolo-ia.service';
import { TranscricaoService } from '../transcricao/transcricao.service';
import { EXTS } from './protocolos.constants';

const ESTAVEL_SEG = 90; // arquivo precisa estar sem modificação há N s (OneDrive ainda copiando)
const INTERVALO_POLL_MS = 2000;

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Aguarda o job de transcrição do docservice terminar, fazendo polling. */
  private async aguardarTranscricao(
    protocoloId: number,
  ): Promise<{ transcricao: string; duracaoSeg: number }> {
    for (;;) {
      const job = await this.transcricao.status(protocoloId);
      if (job && job.status === 'concluido') {
        return { transcricao: job.transcricao, duracaoSeg: job.duracaoSeg };
      }
      if (job && job.status === 'erro') {
        throw new Error(job.mensagem);
      }
      await this.sleep(INTERVALO_POLL_MS);
    }
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
        await this.transcricao.iniciar(id, p.videoCaminho);
        const t = await this.aguardarTranscricao(id);
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
      const { campos, bruto } = await this.ia.analisar(
        texto,
        p.videoNome || '',
      );
      await this.protocolos.atualizar(id, { ...campos, textoIa: bruto });

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
