import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

export type DocumentoConteudo = 'levantamento' | 'projeto';

@Injectable({ providedIn: 'root' })
export class DocConteudoService {
  private readonly http = inject(HttpClient);

  private base(projetoId: number, doc: DocumentoConteudo): string {
    return `${environment.apiUrl}/projetos/${projetoId}/doc-conteudo/${doc}`;
  }

  async valores(projetoId: number, doc: DocumentoConteudo): Promise<Record<string, string>> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<Record<string, string>>>(this.base(projetoId, doc)));
    return r.data;
  }

  async salvar(projetoId: number, doc: DocumentoConteudo, campos: Record<string, string>): Promise<void> {
    await firstValueFrom(this.http.put(this.base(projetoId, doc), campos));
  }
}
