import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PainelHome } from '../models/painel.model';

@Injectable({ providedIn: 'root' })
export class PainelService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/painel`;

  async home(): Promise<PainelHome> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<PainelHome>>(`${this.base}/home`));
    return res.data;
  }
}
