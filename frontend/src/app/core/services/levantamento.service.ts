import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { LevantamentoDados } from '../models/levantamento.model';

@Injectable({ providedIn: 'root' })
export class LevantamentoService {
  private readonly http = inject(HttpClient);

  private base(projetoId: number): string {
    return `${environment.apiUrl}/projetos/${projetoId}/levantamento`;
  }

  async obter(projetoId: number): Promise<LevantamentoDados> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<LevantamentoDados>>(this.base(projetoId)));
    return r.data;
  }

  async salvar(projetoId: number, respostas: Record<string, string>): Promise<number> {
    const r = await firstValueFrom(
      this.http.put<ApiEnvelope<{ respondidas: number }>>(this.base(projetoId), respostas),
    );
    return r.data.respondidas;
  }
}
