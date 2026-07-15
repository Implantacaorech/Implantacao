import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { Documento, EventoProjeto, SlugDocumentoFiel } from '../models/documento.model';

export interface ArquivoBaixado {
  blob: Blob;
  filename: string;
}

function nomeArquivo(contentDisposition: string | null, fallback: string): string {
  const m = /filename="?([^";]+)"?/.exec(contentDisposition ?? '');
  return m?.[1] ?? fallback;
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  async listar(projetoId: number): Promise<Documento[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Documento[]>>(`${this.base}/projetos/${projetoId}/documentos`),
    );
    return res.data;
  }

  async eventos(projetoId: number): Promise<EventoProjeto[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<EventoProjeto[]>>(`${this.base}/projetos/${projetoId}/eventos`),
    );
    return res.data;
  }

  async gerarLayout(
    projetoId: number,
    slug: SlugDocumentoFiel,
    modo?: 'auto' | 'modelo',
  ): Promise<ArquivoBaixado> {
    const params = modo ? { modo } : undefined;
    const res = await firstValueFrom(
      this.http.post(`${this.base}/projetos/${projetoId}/gerar-layout/${slug}`, null, {
        params,
        responseType: 'blob',
        observe: 'response',
      }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), `${slug}`),
    };
  }

  async baixar(documentoId: number, nomeSugerido: string): Promise<ArquivoBaixado> {
    const res = await firstValueFrom(
      this.http.get(`${this.base}/documentos/${documentoId}/baixar`, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), nomeSugerido),
    };
  }
}
