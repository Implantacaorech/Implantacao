import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  CampoTextoProtocolo,
  FichaProtocolo,
  FiltroProtocolos,
  ListaProtocolos,
  StatusProcessamento,
} from '../models/protocolo.model';

@Injectable({ providedIn: 'root' })
export class ProtocoloService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/protocolos`;

  async listar(filtro: FiltroProtocolos = {}): Promise<ListaProtocolos> {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtro)) {
      if (valor) params = params.set(chave, valor);
    }
    const r = await firstValueFrom(this.http.get<ApiEnvelope<ListaProtocolos>>(this.base, { params }));
    return r.data;
  }

  async enviar(arquivo: File): Promise<{ id: number; novo: boolean; aviso: string }> {
    const form = new FormData();
    form.append('video', arquivo);
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ id: number; novo: boolean; aviso: string }>>(`${this.base}/novo`, form),
    );
    return r.data;
  }

  async ficha(id: number): Promise<FichaProtocolo> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<FichaProtocolo>>(`${this.base}/${id}`));
    return r.data;
  }

  async salvar(id: number, campos: Partial<Record<CampoTextoProtocolo, string>>): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/salvar`, campos));
  }

  async processar(id: number): Promise<{ iniciado: boolean; aviso: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ iniciado: boolean; aviso: string }>>(`${this.base}/${id}/processar`, {}),
    );
    return r.data;
  }

  async aprovar(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/aprovar`, {}));
  }

  async reprovar(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/reprovar`, {}));
  }

  async status(id: number): Promise<StatusProcessamento> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<StatusProcessamento>>(`${this.base}/${id}/status`));
    return r.data;
  }

  async video(id: number): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.base}/${id}/video`, { responseType: 'blob' }));
  }
}
