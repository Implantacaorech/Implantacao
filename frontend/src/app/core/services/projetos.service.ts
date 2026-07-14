import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { AtualizarProjetoPayload, CriarProjetoPayload, Projeto } from '../models/projeto.model';

export interface FiltroProjetos {
  page?: number;
  limit?: number;
  cliente?: string;
  etapa?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjetosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/projetos`;

  async listar(filtro: FiltroProjetos = {}): Promise<ApiEnvelope<Projeto[]>> {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtro)) {
      if (valor !== undefined && valor !== '') params = params.set(chave, String(valor));
    }
    return firstValueFrom(this.http.get<ApiEnvelope<Projeto[]>>(this.base, { params }));
  }

  async buscar(id: number): Promise<Projeto> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<Projeto>>(`${this.base}/${id}`));
    return res.data;
  }

  async criar(dto: CriarProjetoPayload): Promise<Projeto> {
    const res = await firstValueFrom(this.http.post<ApiEnvelope<Projeto>>(this.base, dto));
    return res.data;
  }

  async atualizar(id: number, dto: AtualizarProjetoPayload): Promise<Projeto> {
    const res = await firstValueFrom(this.http.put<ApiEnvelope<Projeto>>(`${this.base}/${id}`, dto));
    return res.data;
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/${id}`));
  }
}
