import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PainelAtividade } from '../models/atividade.model';
import { ResultadoMonitoramento } from '../models/monitoramento.model';

@Injectable({ providedIn: 'root' })
export class AtividadeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/painel`;

  async atividade(): Promise<PainelAtividade> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<PainelAtividade>>(`${this.base}/atividade`));
    return res.data;
  }

  async monitoramento(): Promise<ResultadoMonitoramento> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoMonitoramento>>(`${this.base}/monitoramento`),
    );
    return res.data;
  }
}
