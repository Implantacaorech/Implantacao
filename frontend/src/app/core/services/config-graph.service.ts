import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { SalvarConfigGraphPayload, StatusConfigGraph } from '../models/config-graph.model';

@Injectable({ providedIn: 'root' })
export class ConfigGraphService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/graph`;

  async status(): Promise<StatusConfigGraph> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigGraph>>(this.base));
    return res.data;
  }

  async salvar(dto: SalvarConfigGraphPayload): Promise<StatusConfigGraph> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<StatusConfigGraph>>(this.base, dto));
    return res.data;
  }
}
