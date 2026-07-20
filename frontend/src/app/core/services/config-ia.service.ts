import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { SalvarChaveIa, StatusConfigIa } from '../models/config-ia.model';

@Injectable({ providedIn: 'root' })
export class ConfigIaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/ia`;

  async status(): Promise<StatusConfigIa> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigIa>>(this.base));
    return res.data;
  }

  async salvar(dados: SalvarChaveIa): Promise<StatusConfigIa> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<StatusConfigIa>>(this.base, dados));
    return res.data;
  }
}
