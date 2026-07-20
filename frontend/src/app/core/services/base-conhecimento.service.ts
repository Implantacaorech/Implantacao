import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ResultadoBuscaSiger, StatusBaseConhecimentoSiger } from '../models/siger-fonte.model';

@Injectable({ providedIn: 'root' })
export class BaseConhecimentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/base-conhecimento`;

  async pesquisar(q: string): Promise<ResultadoBuscaSiger[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoBuscaSiger[]>>(`${this.base}/pesquisar`, { params: { q } }),
    );
    return res.data;
  }

  async status(): Promise<StatusBaseConhecimentoSiger> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<StatusBaseConhecimentoSiger>>(`${this.base}/status`),
    );
    return res.data;
  }
}
