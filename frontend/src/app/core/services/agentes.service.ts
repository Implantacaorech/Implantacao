import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { AgenteExecucao, GrafoAgentes } from '../models/agente.model';

@Injectable({ providedIn: 'root' })
export class AgentesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/agentes`;

  async grafo(): Promise<GrafoAgentes> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<GrafoAgentes>>(`${this.base}/grafo`));
    return res.data;
  }

  async execucoes(limite = 20): Promise<AgenteExecucao[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<AgenteExecucao[]>>(`${this.base}/execucoes`, { params: { limite } }),
    );
    return res.data;
  }
}
