import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { EstadoAutomacao, Prontidao } from '../models/prontidao.model';

/** Acesso à Auditoria de Prontidão dos 9 eixos (`GET /api/prontidao`) e ao kill switch de
 * runtime (`POST /api/automacao/{pausar,retomar}`, eixo 4). A URL da API e o HttpClient ficam
 * AQUI, no service — o componente nunca fala HTTP direto (regra de conformidade do frontend). */
@Injectable({ providedIn: 'root' })
export class ProntidaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/prontidao`;
  private readonly baseAutomacao = `${environment.apiUrl}/automacao`;

  async obter(): Promise<Prontidao> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Prontidao>>(this.base),
    );
    return res.data;
  }

  async pausar(motivo: string): Promise<EstadoAutomacao> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<EstadoAutomacao>>(
        `${this.baseAutomacao}/pausar`,
        { motivo },
      ),
    );
    return res.data;
  }

  async retomar(): Promise<EstadoAutomacao> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<EstadoAutomacao>>(
        `${this.baseAutomacao}/retomar`,
        {},
      ),
    );
    return res.data;
  }
}
