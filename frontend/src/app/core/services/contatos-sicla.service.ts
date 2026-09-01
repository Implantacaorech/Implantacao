import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ListaContatosSicla,
  ResultadoLiberacao,
  ResultadoRevogacao,
} from '../models/contato-sicla.model';

interface ApiEnvelope<T> {
  data: T;
}

/** Acesso de Clientes — contatos do SICLA que recebem conta no Painel. */
@Injectable({ providedIn: 'root' })
export class ContatosSiclaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/contatos-sicla`;

  async listar(
    cliente: string,
    termo = '',
    somenteNaoLiberados = false,
  ): Promise<ListaContatosSicla> {
    const params: Record<string, string> = {};
    if (cliente.trim()) params['cliente'] = cliente.trim();
    if (termo.trim()) params['termo'] = termo.trim();
    if (somenteNaoLiberados) params['novos'] = '1';
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<ListaContatosSicla>>(this.base, { params }),
    );
    return r.data;
  }

  async liberar(cliente: string, emails: string[]): Promise<ResultadoLiberacao> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoLiberacao>>(`${this.base}/liberar`, {
        cliente,
        emails,
      }),
    );
    return r.data;
  }

  async revogar(emails: string[]): Promise<ResultadoRevogacao> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoRevogacao>>(`${this.base}/revogar`, {
        emails,
      }),
    );
    return r.data;
  }
}
