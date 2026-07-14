import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type StatusTranscricao =
  | { status: 'processando'; pct: number | null; pos: number; dur: number }
  | { status: 'concluido'; transcricao: string; duracaoSeg: number; idioma: string }
  | { status: 'erro'; mensagem: string };

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
  async iniciar(protocoloId: number, caminhoVideo: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post('/transcrever', { protocoloId, caminhoVideo }),
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
}
