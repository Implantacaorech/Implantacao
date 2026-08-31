import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  RespostaConsultorSiger,
  StatusConsultorSiger,
  VisaoConsulta,
} from '../models/consultor-siger.model';

@Injectable({ providedIn: 'root' })
export class ConsultorSigerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/consultor-siger`;

  /** Pergunta em linguagem natural → resposta estruturada com evidências e confiança. */
  async pesquisar(q: string, visao: VisaoConsulta): Promise<RespostaConsultorSiger> {
    const params = new HttpParams().set('q', q).set('visao', visao);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<RespostaConsultorSiger>>(`${this.base}/pesquisa`, { params }),
    );
    // Blindagem contra bundle novo x backend antigo (mesmo idioma dos services de BI).
    const d = res.data;
    return {
      ...d,
      secoes: d.secoes ?? {},
      assuntosRelacionados: d.assuntosRelacionados ?? [],
      sugestoes: d.sugestoes ?? [],
      fontes: d.fontes ?? [],
    };
  }

  /** Estado da base derivada — a tela usa para avisar quando ela não está disponível. */
  async status(): Promise<StatusConsultorSiger> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<StatusConsultorSiger>>(`${this.base}/status`),
    );
    return res.data;
  }

  /** Avaliação da resposta (👍/👎) — registrada pelo backend fora da fonte. */
  async enviarFeedback(pergunta: string, util: boolean, observacao?: string): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiEnvelope<{ ok: boolean }>>(`${this.base}/feedback`, {
        pergunta,
        util,
        ...(observacao ? { observacao } : {}),
      }),
    );
  }
}
