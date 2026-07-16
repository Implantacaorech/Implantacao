import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { CriarFluxoPayload, ResultadoCriarFluxo, ResultadoInbox, ResultadoParse, StatusFluxo } from '../models/fluxo.model';

@Injectable({ providedIn: 'root' })
export class FluxoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/fluxo`;

  async status(): Promise<StatusFluxo> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<StatusFluxo>>(this.base));
    return r.data;
  }

  async parse(texto: string): Promise<ResultadoParse> {
    const r = await firstValueFrom(this.http.post<ApiEnvelope<ResultadoParse>>(`${this.base}/parse`, { texto }));
    return r.data;
  }

  async inbox(): Promise<ResultadoInbox> {
    const r = await firstValueFrom(this.http.post<ApiEnvelope<ResultadoInbox>>(`${this.base}/inbox`, {}));
    return r.data;
  }

  async criar(dto: CriarFluxoPayload): Promise<ResultadoCriarFluxo> {
    const r = await firstValueFrom(this.http.post<ApiEnvelope<ResultadoCriarFluxo>>(`${this.base}/criar`, dto));
    return r.data;
  }
}
