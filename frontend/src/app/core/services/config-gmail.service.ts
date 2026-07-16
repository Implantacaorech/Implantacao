import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { StatusConfigGmail } from '../models/config-gmail.model';

@Injectable({ providedIn: 'root' })
export class ConfigGmailService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/config/gmail`;

  async status(): Promise<StatusConfigGmail> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<StatusConfigGmail>>(this.base));
    return res.data;
  }

  async enviarCliente(arquivo: File): Promise<void> {
    const form = new FormData();
    form.append('client', arquivo);
    await firstValueFrom(this.http.post<ApiEnvelope<{ temCliente: boolean }>>(`${this.base}/client`, form));
  }

  /** Devolve a URL de consentimento do Google — quem chama deve navegar o browser
   * inteiro até ela (`window.location.href = url`), não é uma chamada de API comum:
   * o Google redireciona de volta para /config/gmail?autorizado=1 (ou ?erro=...) depois
   * do consentimento, via GET /config/gmail/callback (rota pública no backend). */
  async urlAutorizacao(): Promise<string> {
    const res = await firstValueFrom(this.http.get<ApiEnvelope<{ url: string }>>(`${this.base}/autorizar`));
    return res.data.url;
  }
}
