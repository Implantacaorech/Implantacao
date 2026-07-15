import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PainelCoordenacao, ResultadoDigest } from '../models/coordenacao.model';
import { ResultadoCapacidade } from '../models/capacidade.model';

@Injectable({ providedIn: 'root' })
export class CoordenacaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/painel`;

  async coordenacao(): Promise<PainelCoordenacao> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PainelCoordenacao>>(`${this.base}/coordenacao`),
    );
    return res.data;
  }

  async capacidade(modulos: string, semanas: number): Promise<ResultadoCapacidade> {
    let params = new HttpParams();
    if (modulos) params = params.set('modulos', modulos);
    if (semanas) params = params.set('semanas', String(semanas));
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoCapacidade>>(`${this.base}/coordenacao/capacidade`, { params }),
    );
    return res.data;
  }

  async enviarDigest(): Promise<ResultadoDigest> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoDigest>>(`${this.base}/coordenacao/digest`, {}),
    );
    return res.data;
  }
}
