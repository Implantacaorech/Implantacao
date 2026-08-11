import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type StatusTranscricao =
  | { status: 'processando'; pct: number | null; pos: number; dur: number }
  | {
      status: 'concluido';
      transcricao: string;
      duracaoSeg: number;
      idioma: string;
    }
  | { status: 'erro'; mensagem: string };

/** Andamento de uma gravação ao vivo (POST /transcrever/vivo/{id} no docservice). */
export interface EstadoGravacaoVivo {
  /** O modelo já terminou de carregar? Antes disso o áudio é aceito, só demora a voltar. */
  pronto: boolean;
  duracaoSeg: number;
  trechos: number;
  /** Trechos recebidos que ainda não voltaram do transcritor. */
  pendentes: number;
  texto: string;
  erro: string | null;
}

export interface ResultadoGravacaoVivo {
  texto: string;
  duracaoSeg: number;
  caminhoAudio: string;
  trechos: number;
  pendentes: number;
  erro: string | null;
}

function detalheErro(e: unknown): string {
  const axiosErr = e as AxiosError<{ detail?: string }>;
  return (
    axiosErr.response?.data?.detail ?? axiosErr.message ?? 'erro desconhecido'
  );
}

/** Cliente HTTP do job de transcrição do docservice (faster-whisper, local, CPU) — nunca
 * exposto publicamente, chamado só por este backend. `iniciar` dispara em segundo plano
 * (docservice devolve na hora); `status` é polled até 'concluido'/'erro'. Ver
 * docs/migracao/02-decisao-arquitetura.md, "Arquitetura híbrida". */
@Injectable()
export class TranscricaoService {
  constructor(private readonly http: HttpService) {}

  /** Dispara a transcrição. Lança se o vídeo não existir (404) ou se já houver um job em
   * andamento para este protocolo (409) — ambos erros de programação/estado inesperado do
   * chamador, não do usuário final. */
  async iniciar(
    protocoloId: number,
    caminhoVideo: string,
    vocabulario = '',
    pessoas = 0,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/transcrever', {
          protocoloId,
          caminhoVideo,
          vocabulario,
          pessoas,
        }),
      );
    } catch (e) {
      const axiosErr = e as AxiosError<{ detail?: string }>;
      const detalhe = axiosErr.response?.data?.detail ?? axiosErr.message;
      throw new InternalServerErrorException(
        `Falha ao iniciar a transcrição: ${detalhe}`,
      );
    }
  }

  async status(protocoloId: number): Promise<StatusTranscricao | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(`/transcrever/${protocoloId}/status`),
      );
      return res.data as StatusTranscricao;
    } catch (e) {
      const axiosErr = e as AxiosError;
      if (axiosErr.response?.status === 404) return null;
      throw new InternalServerErrorException(
        `Serviço de transcrição indisponível: ${axiosErr.message ?? 'erro desconhecido'}`,
      );
    }
  }

  /** Desiste da transcrição do ARQUIVO: o docservice mata o subprocesso e esquece o job.
   *
   * Best-effort, como o `vivoCancelar`: se o serviço não responder, não há nada para matar
   * do outro lado e o painel não pode ficar preso por causa disso. Vale também para
   * descartar um resultado já pronto que ninguém vai mais buscar (exclusão do protocolo) —
   * é a transcrição inteira ocupando memória do docservice até ele reiniciar. */
  async cancelar(protocoloId: number): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/transcrever/${protocoloId}`));
    } catch {
      // Job inexistente ou serviço fora — não há o que cancelar do outro lado.
    }
  }

  // ------------------------------------------------------------------ ao vivo (reunião)

  /** Abre a sessão de gravação ao vivo no docservice (sobe o worker com o modelo
   * aquecido). `sessaoId` é o id do próprio Protocolo. */
  async vivoIniciar(sessaoId: number, vocabulario = ''): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/transcrever/vivo', { sessaoId, vocabulario }),
      );
    } catch (e) {
      throw new ServiceUnavailableException(
        `Não foi possível iniciar a gravação: ${detalheErro(e)}`,
      );
    }
  }

  /** Envia um trecho de áudio (WAV 16 kHz mono 16 bits) para transcrição imediata. */
  async vivoTrecho(
    sessaoId: number,
    seq: number,
    audio: Buffer,
  ): Promise<{ inicioSeg: number }> {
    try {
      const res = await firstValueFrom(
        this.http.post(`/transcrever/vivo/${sessaoId}/trecho`, {
          seq,
          audioBase64: audio.toString('base64'),
        }),
      );
      return res.data as { inicioSeg: number };
    } catch (e) {
      const axiosErr = e as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(
          'A gravação não está mais ativa no servidor (o serviço de transcrição foi reiniciado?).',
        );
      }
      throw new ServiceUnavailableException(
        `Falha ao enviar o áudio: ${detalheErro(e)}`,
      );
    }
  }

  /** Andamento da gravação — é o que a tela mostra enquanto a reunião acontece. `null`
   * quando o docservice não conhece (mais) a sessão. */
  async vivoEstado(sessaoId: number): Promise<EstadoGravacaoVivo | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(`/transcrever/vivo/${sessaoId}`),
      );
      return res.data as EstadoGravacaoVivo;
    } catch (e) {
      const axiosErr = e as AxiosError;
      if (axiosErr.response?.status === 404) return null;
      throw new ServiceUnavailableException(
        `Serviço de transcrição indisponível: ${detalheErro(e)}`,
      );
    }
  }

  /** Encerra a gravação: junta os trechos num único .wav em `caminhoDestino` e devolve a
   * transcrição completa. O timeout do HTTP é maior que o do docservice de propósito —
   * quem manda no tempo de espera da fila é o docservice. */
  async vivoFinalizar(
    sessaoId: number,
    caminhoDestino: string,
    timeoutSeg = 300,
  ): Promise<ResultadoGravacaoVivo> {
    try {
      const res = await firstValueFrom(
        this.http.post(
          `/transcrever/vivo/${sessaoId}/finalizar`,
          { caminhoDestino, timeoutSeg },
          { timeout: (timeoutSeg + 60) * 1000 },
        ),
      );
      return res.data as ResultadoGravacaoVivo;
    } catch (e) {
      const axiosErr = e as AxiosError;
      if (axiosErr.response?.status === 404) {
        throw new NotFoundException(
          'A gravação não está mais ativa no servidor — não há áudio para encerrar.',
        );
      }
      throw new ServiceUnavailableException(
        `Falha ao encerrar a gravação: ${detalheErro(e)}`,
      );
    }
  }

  /** Descarta a gravação (mata o worker e apaga os trechos). Best-effort: se o docservice
   * não responder, o cancelamento do lado do painel segue mesmo assim. */
  async vivoCancelar(sessaoId: number): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/transcrever/vivo/${sessaoId}`));
    } catch {
      // Sessão já morta ou serviço fora — não há o que cancelar do outro lado.
    }
  }
}
