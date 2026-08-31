import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ResultadoAgendaCalendario,
  UsuarioAgenda,
} from '../models/agenda-calendario.model';

@Injectable({ providedIn: 'root' })
export class AgendaCalendarioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/agenda`;

  /** Usuários do Painel (tabela `usuarios`, ativos ou não) — a fonte do filtro de
   * técnicos. */
  async usuarios(): Promise<UsuarioAgenda[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<UsuarioAgenda[]>>(`${this.base}/usuarios`),
    );
    return res.data ?? [];
  }

  /** Compromissos dos técnicos na janela [ini, fim] (inclusiva). Sem parâmetros, o backend
   * responde a semana de hoje (domingo→sábado). */
  async calendario(ini?: string, fim?: string): Promise<ResultadoAgendaCalendario> {
    let params = new HttpParams();
    if (ini) params = params.set('ini', ini);
    if (fim) params = params.set('fim', fim);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoAgendaCalendario>>(`${this.base}/calendario`, { params }),
    );
    // Blindagem contra bundle novo x backend antigo (mesmo idioma dos services de BI).
    const d = res.data;
    return {
      ...d,
      dias: d.dias ?? [],
      responsaveis: d.responsaveis ?? [],
      resumo: d.resumo ?? [],
    };
  }
}
