import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ChecklistModeloLinha,
  IndiceTopicoLinha,
  ModeloDocumento,
  ModeloDocumentoCampo,
  ModeloDocumentoVersao,
} from '../models/cadastros.model';

export interface ArquivoBaixado {
  blob: Blob;
  filename: string;
}

function nomeArquivo(contentDisposition: string | null, fallback: string): string {
  const m = /filename="?([^";]+)"?/.exec(contentDisposition ?? '');
  return m?.[1] ?? fallback;
}

@Injectable({ providedIn: 'root' })
export class CadastrosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cadastros`;

  // --- Check List --------------------------------------------------------------------

  async checklistListar(
    filtro: { mod?: string; q?: string; offset?: number; limite?: number } = {},
  ): Promise<{ linhas: ChecklistModeloLinha[]; total: number; modulos: string[] }> {
    const res = await firstValueFrom(
      this.http.get<
        ApiEnvelope<{ linhas: ChecklistModeloLinha[]; total: number; modulos: string[] }>
      >(`${this.base}/checklist`, { params: filtroParaParams(filtro) }),
    );
    return res.data;
  }

  async checklistSalvar(linha: ChecklistModeloLinha): Promise<ChecklistModeloLinha> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ChecklistModeloLinha>>(`${this.base}/checklist`, linha),
    );
    return res.data;
  }

  async checklistExcluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/checklist/${id}`));
  }

  async checklistReimportar(): Promise<number> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ n: number }>>(`${this.base}/checklist/reimportar`, {}),
    );
    return res.data.n;
  }

  // --- Índice de Tópicos ---------------------------------------------------------------

  async indiceListar(
    filtro: { mod?: string; q?: string } = {},
  ): Promise<{ linhas: IndiceTopicoLinha[]; total: number; modulos: string[] }> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<{ linhas: IndiceTopicoLinha[]; total: number; modulos: string[] }>>(
        `${this.base}/indice`,
        { params: filtroParaParams(filtro) },
      ),
    );
    return res.data;
  }

  async indiceSalvar(linha: IndiceTopicoLinha): Promise<IndiceTopicoLinha> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<IndiceTopicoLinha>>(`${this.base}/indice`, linha),
    );
    return res.data;
  }

  async indiceExcluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/indice/${id}`));
  }

  async indiceReimportar(): Promise<number> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ n: number }>>(`${this.base}/indice/reimportar`, {}),
    );
    return res.data.n;
  }

  // --- Modelos de Documentos -------------------------------------------------------------

  async modelosListar(): Promise<ModeloDocumento[]> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<ModeloDocumento[]>>(`${this.base}/modelos`));
    return res.data;
  }

  async modeloDetalhe(
    id: number,
  ): Promise<{ modelo: ModeloDocumento; versoes: ModeloDocumentoVersao[]; campos: ModeloDocumentoCampo[] }> {
    const res = await firstValueFrom(
      this.http.get<
        ApiEnvelope<{ modelo: ModeloDocumento; versoes: ModeloDocumentoVersao[]; campos: ModeloDocumentoCampo[] }>
      >(`${this.base}/modelos/${id}`),
    );
    return res.data;
  }

  async modeloEnviarVersao(id: number, arquivo: File, motivo: string): Promise<number> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('motivo', motivo);
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ versao: number }>>(`${this.base}/modelos/${id}/versao`, form),
    );
    return res.data.versao;
  }

  async modeloBaixar(id: number, nomeSugerido: string, versaoId?: number): Promise<ArquivoBaixado> {
    const params = versaoId ? { versaoId: String(versaoId) } : undefined;
    const res = await firstValueFrom(
      this.http.get(`${this.base}/modelos/${id}/baixar`, { params, responseType: 'blob', observe: 'response' }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), nomeSugerido),
    };
  }

  async modeloCampoSalvar(id: number, campo: ModeloDocumentoCampo): Promise<ModeloDocumentoCampo> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ModeloDocumentoCampo>>(`${this.base}/modelos/${id}/campos`, campo),
    );
    return res.data;
  }

  async modeloCampoExcluir(id: number, campoId: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/modelos/${id}/campos/${campoId}`));
  }
}

function filtroParaParams(filtro: Record<string, string | number | undefined>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtro)) {
    if (v !== undefined && v !== '') params[k] = String(v);
  }
  return params;
}
