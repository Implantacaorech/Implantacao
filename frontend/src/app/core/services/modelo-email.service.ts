import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ModeloEmail, SalvarModeloEmailPayload } from '../models/modelo-email.model';

@Injectable({ providedIn: 'root' })
export class ModeloEmailService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/modelos-email`;

  async listar(apenasAtivos = false): Promise<ModeloEmail[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<{ itens: ModeloEmail[] }>>(this.base, {
        params: { apenasAtivos: String(apenasAtivos) },
      }),
    );
    return res.data.itens;
  }

  async obter(id: number): Promise<ModeloEmail> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<ModeloEmail>>(`${this.base}/${id}`));
    return res.data;
  }

  async criar(dto: SalvarModeloEmailPayload): Promise<ModeloEmail> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<ModeloEmail>>(this.base, dto));
    return res.data;
  }

  async atualizar(id: number, dto: SalvarModeloEmailPayload): Promise<ModeloEmail> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<ModeloEmail>>(`${this.base}/${id}`, dto));
    return res.data;
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.post<ApiEnvelope<{ excluido: boolean }>>(`${this.base}/${id}/excluir`, {}));
  }

  async alternarAtivo(id: number): Promise<ModeloEmail> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<ModeloEmail>>(`${this.base}/${id}/toggle`, {}));
    return res.data;
  }
}
