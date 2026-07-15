import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { DashboardDisponivel, FiltroDashboard, ResultadoDashboard } from '../models/dashboards.model';

@Injectable({ providedIn: 'root' })
export class DashboardsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dashboards`;

  async listar(): Promise<DashboardDisponivel[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<{ itens: DashboardDisponivel[] }>>(this.base),
    );
    return res.data.itens;
  }

  async rodar(slug: string, filtro: FiltroDashboard = {}): Promise<ResultadoDashboard> {
    let params = new HttpParams();
    if (filtro.ref) params = params.set('ref', filtro.ref);
    if (filtro.direcao) params = params.set('direcao', filtro.direcao);
    if (filtro.n) params = params.set('n', String(filtro.n));
    if (filtro.mesSel) params = params.set('mesSel', String(filtro.mesSel));
    if (filtro.anoSel) params = params.set('anoSel', String(filtro.anoSel));
    for (const s of filtro.situacao ?? []) params = params.append('situacao', s);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoDashboard>>(`${this.base}/${slug}`, { params }),
    );
    return res.data;
  }
}
