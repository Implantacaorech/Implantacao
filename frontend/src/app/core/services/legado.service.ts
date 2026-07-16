import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  FormLegadoValor,
  GrupoCatalogo,
  ResultadoCriarTemplates,
  ResultadoFormModulos,
  ResultadoGerar,
  ResultadoImportarSequencia,
  ResultadoSaude,
  ResultadoVerbalTexto,
} from '../models/legado.model';

export type FormLegado = Record<string, FormLegadoValor>;

@Injectable({ providedIn: 'root' })
export class LegadoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/legado`;

  async iaStatus(): Promise<{ ativa: boolean; modelo: string }> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<{ ativa: boolean; modelo: string }>>(`${this.base}/ia-status`),
    );
    return r.data;
  }

  async saude(): Promise<ResultadoSaude> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<ResultadoSaude>>(`${this.base}/saude`));
    return r.data;
  }

  async catalogo(): Promise<GrupoCatalogo[]> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<GrupoCatalogo[]>>(`${this.base}/catalogo`));
    return r.data;
  }

  async definirCliente(form: FormLegado): Promise<{ arquivo: string; nome: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ arquivo: string; nome: string }>>(`${this.base}/cliente`, { form }),
    );
    return r.data;
  }

  async criarTemplates(form: FormLegado): Promise<ResultadoCriarTemplates> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoCriarTemplates>>(`${this.base}/criar-templates`, { form }),
    );
    return r.data;
  }

  async converterVerbalTexto(texto: string): Promise<ResultadoVerbalTexto> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoVerbalTexto>>(`${this.base}/verbal/texto`, { texto }),
    );
    return r.data;
  }

  async converterVerbalDocx(arquivo: File): Promise<{ token: string; rotulo: string; nome: string }> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ token: string; rotulo: string; nome: string }>>(
        `${this.base}/verbal/docx`,
        form,
      ),
    );
    return r.data;
  }

  async formModulos(
    tipo: 'levantamento' | 'checklist',
    form: FormLegado,
    modulos: string[],
  ): Promise<ResultadoFormModulos> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoFormModulos>>(`${this.base}/form-modulos`, { tipo, form, modulos }),
    );
    return r.data;
  }

  async importar(arquivo: File): Promise<ResultadoImportarSequencia> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoImportarSequencia>>(`${this.base}/importar`, form),
    );
    return r.data;
  }

  async gerar(mod: string, yaml: File | null, clienteArquivo?: string): Promise<ResultadoGerar> {
    const form = new FormData();
    form.append('mod', mod);
    if (clienteArquivo) form.append('clienteArquivo', clienteArquivo);
    if (yaml) form.append('yaml', yaml);
    const r = await firstValueFrom(this.http.post<ApiEnvelope<ResultadoGerar>>(`${this.base}/gerar`, form));
    return r.data;
  }

  async baixar(token: string, nomeSugerido: string): Promise<{ blob: Blob; filename: string }> {
    const res = await firstValueFrom(
      this.http.get(`${this.base}/baixar/${token}`, { responseType: 'blob', observe: 'response' }),
    );
    const m = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '');
    return { blob: res.body as Blob, filename: m?.[1] ?? nomeSugerido };
  }
}
