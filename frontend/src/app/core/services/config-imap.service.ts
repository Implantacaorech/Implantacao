import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { SalvarConfigImapPayload, StatusConfigImap } from '../models/config-imap.model';

@Injectable({ providedIn: 'root' })
export class ConfigImapService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/imap`;

  async status(): Promise<StatusConfigImap> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigImap>>(this.base));
    return res.data;
  }

  async salvar(dto: SalvarConfigImapPayload): Promise<StatusConfigImap> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<StatusConfigImap>>(this.base, dto));
    return res.data;
  }
}
