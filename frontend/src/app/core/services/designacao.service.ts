import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { AgendarView, ConsultoresView, DefinirGciView } from '../models/designacao.model';
import { Projeto } from '../models/projeto.model';

@Injectable({ providedIn: 'root' })
export class DesignacaoService {
  private readonly http = inject(HttpClient);
  private readonly base = (projetoId: number) => `${environment.apiUrl}/projetos/${projetoId}`;

  async obterDefinirGci(projetoId: number): Promise<DefinirGciView> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<DefinirGciView>>(`${this.base(projetoId)}/definir-gci`),
    );
    return res.data;
  }

  async definirGci(projetoId: number, gcis: string[]): Promise<Projeto> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Projeto>>(`${this.base(projetoId)}/definir-gci`, { gcis }),
    );
    return res.data;
  }

  async obterAgendar(projetoId: number): Promise<AgendarView> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<AgendarView>>(`${this.base(projetoId)}/agendar`),
    );
    return res.data;
  }

  /** Agenda o Levantamento. A data é única (a visita é a mesma), mas pode haver mais de um
   * levantador — é o passo 2 do processo. */
  async agendar(
    projetoId: number,
    dataLevantamento: string,
    levantadores: string[] = [],
  ): Promise<Projeto> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Projeto>>(`${this.base(projetoId)}/agendar`, {
        dataLevantamento,
        levantadores,
      }),
    );
    return res.data;
  }

  async obterConsultores(projetoId: number): Promise<ConsultoresView> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ConsultoresView>>(`${this.base(projetoId)}/consultores`),
    );
    return res.data;
  }
}
