import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { TelemetriaIa } from '../models/ia-telemetria.model';

/** Telemetria de custo/execuções de IA (`GET /api/ia/telemetria`). */
@Injectable({ providedIn: 'root' })
export class IaTelemetriaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/ia/telemetria`;

  async resumo(): Promise<TelemetriaIa> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<TelemetriaIa>>(this.base),
    );
    return res.data;
  }
}
