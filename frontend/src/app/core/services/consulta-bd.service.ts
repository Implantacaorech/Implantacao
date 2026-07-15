import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { ConsultaBD, ResultadoExecucaoSql, SalvarConsultaBdPayload } from '../models/consulta-bd.model';

@Injectable({ providedIn: 'root' })
export class ConsultaBdService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/consultas-bd`;

  async listar(): Promise<ConsultaBD[]> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<{ itens: ConsultaBD[] }>>(this.base));
    return res.data.itens;
  }

  async obter(slug: string): Promise<ConsultaBD> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<ConsultaBD>>(`${this.base}/${slug}`));
    return res.data;
  }

  async criar(dto: SalvarConsultaBdPayload): Promise<ConsultaBD> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<ConsultaBD>>(this.base, dto));
    return res.data;
  }

  async atualizar(slug: string, dto: SalvarConsultaBdPayload): Promise<ConsultaBD> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<ConsultaBD>>(`${this.base}/${slug}`, dto));
    return res.data;
  }

  async excluir(slug: string): Promise<void> {
    await firstValueFrom(this.http.post<ApiEnvelope<{ excluido: boolean }>>(`${this.base}/${slug}/excluir`, {}));
  }

  async testar(slug: string): Promise<ResultadoExecucaoSql> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoExecucaoSql>>(`${this.base}/${slug}/testar`, {}),
    );
    return res.data;
  }
}
