import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  DocumentoDetalhe,
  FiltroSigla,
  RespostaDicionario,
  ResultadoPesquisaDicionario,
  StatusDicionario,
} from '../models/dicionario.model';

@Injectable({ providedIn: 'root' })
export class DicionarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dicionario`;

  async pesquisar(params: { q?: string; tipo?: string; sigla?: string }): Promise<ResultadoPesquisaDicionario[]> {
    const query: Record<string, string> = {};
    if (params.q) query['q'] = params.q;
    if (params.tipo) query['tipo'] = params.tipo;
    if (params.sigla) query['sigla'] = params.sigla;
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoPesquisaDicionario[]>>(`${this.base}/pesquisar`, { params: query }),
    );
    return res.data;
  }

  async siglas(): Promise<FiltroSigla[]> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<FiltroSigla[]>>(`${this.base}/siglas`));
    return res.data;
  }

  async status(): Promise<StatusDicionario> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusDicionario>>(`${this.base}/status`));
    return res.data;
  }

  async perguntar(pergunta: string): Promise<RespostaDicionario> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<RespostaDicionario>>(`${this.base}/perguntar`, { pergunta }),
    );
    return res.data;
  }

  async documento(slug: string): Promise<DocumentoDetalhe> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<DocumentoDetalhe>>(`${this.base}/${slug}`),
    );
    return res.data;
  }
}
