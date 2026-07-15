import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ImportarMatrizResultado,
  MatrizFichaView,
  MatrizListaView,
  SalvarNotasMatrizPayload,
} from '../models/matriz.model';

@Injectable({ providedIn: 'root' })
export class MatrizService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/matriz`;

  async listar(): Promise<MatrizListaView> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<MatrizListaView>>(this.base));
    return res.data;
  }

  async ficha(id: number): Promise<MatrizFichaView> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<MatrizFichaView>>(`${this.base}/${id}`));
    return res.data;
  }

  async salvar(id: number, dto: SalvarNotasMatrizPayload): Promise<void> {
    await firstValueFrom(this.http.post<ApiEnvelope<{ salvo: boolean }>>(`${this.base}/${id}/salvar`, dto));
  }

  async importar(): Promise<ImportarMatrizResultado> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ImportarMatrizResultado>>(`${this.base}/importar`, {}),
    );
    return res.data;
  }
}
