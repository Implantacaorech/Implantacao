import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { SalvarConfigEmailPayload, StatusConfigEmail } from '../models/config-email.model';

@Injectable({ providedIn: 'root' })
export class ConfigEmailService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/email`;

  async status(): Promise<StatusConfigEmail> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigEmail>>(this.base));
    return res.data;
  }

  async salvar(dto: SalvarConfigEmailPayload): Promise<StatusConfigEmail> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<StatusConfigEmail>>(this.base, dto));
    return res.data;
  }
}
