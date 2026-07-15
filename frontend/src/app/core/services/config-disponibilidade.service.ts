import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ResultadoTesteDisponibilidade,
  SalvarConfigDisponibilidadePayload,
  StatusConfigDisponibilidade,
} from '../models/config-disponibilidade.model';

@Injectable({ providedIn: 'root' })
export class ConfigDisponibilidadeService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/disponibilidade`;

  async status(): Promise<StatusConfigDisponibilidade> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigDisponibilidade>>(this.base));
    return res.data;
  }

  async salvar(dto: SalvarConfigDisponibilidadePayload): Promise<StatusConfigDisponibilidade> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<StatusConfigDisponibilidade>>(this.base, dto),
    );
    return res.data;
  }

  async testar(): Promise<ResultadoTesteDisponibilidade> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoTesteDisponibilidade>>(`${this.base}/testar`, {}),
    );
    return res.data;
  }
}
