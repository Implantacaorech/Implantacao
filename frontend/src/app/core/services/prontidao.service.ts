import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { Prontidao } from '../models/prontidao.model';

/** Acesso à Auditoria de Prontidão dos 9 eixos (`GET /api/prontidao`). A URL da API e o
 * HttpClient ficam AQUI, no service — o componente nunca fala HTTP direto (regra de
 * conformidade do frontend). */
@Injectable({ providedIn: 'root' })
export class ProntidaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/prontidao`;

  async obter(): Promise<Prontidao> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Prontidao>>(this.base),
    );
    return res.data;
  }
}
