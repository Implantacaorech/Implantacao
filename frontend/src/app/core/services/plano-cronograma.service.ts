import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ChecklistItem,
  CronogramaItem,
  LinhaChecklist,
  LinhaCronograma,
  Modificacao,
} from '../models/plano-cronograma.model';

interface PlanoView<T> {
  itens: T[];
  historico: Modificacao[];
}

interface SalvarResultado<T> {
  itens: T[];
  mudancas: number;
}

@Injectable({ providedIn: 'root' })
export class PlanoCronogramaService {
  private readonly http = inject(HttpClient);
  private readonly base = (projetoId: number) => `${environment.apiUrl}/projetos/${projetoId}`;

  async obterCronograma(projetoId: number): Promise<PlanoView<CronogramaItem>> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PlanoView<CronogramaItem>>>(`${this.base(projetoId)}/cronograma`),
    );
    return res.data;
  }

  async salvarCronograma(projetoId: number, linhas: LinhaCronograma[]): Promise<SalvarResultado<CronogramaItem>> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<SalvarResultado<CronogramaItem>>>(`${this.base(projetoId)}/cronograma`, { linhas }),
    );
    return res.data;
  }

  async seedCronograma(projetoId: number): Promise<SalvarResultado<CronogramaItem>> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<SalvarResultado<CronogramaItem>>>(`${this.base(projetoId)}/cronograma/seed`, {}),
    );
    return res.data;
  }

  async obterChecklist(projetoId: number): Promise<PlanoView<ChecklistItem>> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PlanoView<ChecklistItem>>>(`${this.base(projetoId)}/checklist`),
    );
    return res.data;
  }

  async salvarChecklist(projetoId: number, linhas: LinhaChecklist[]): Promise<SalvarResultado<ChecklistItem>> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<SalvarResultado<ChecklistItem>>>(`${this.base(projetoId)}/checklist`, { linhas }),
    );
    return res.data;
  }

  async seedChecklist(projetoId: number): Promise<SalvarResultado<ChecklistItem>> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<SalvarResultado<ChecklistItem>>>(`${this.base(projetoId)}/checklist/seed`, {}),
    );
    return res.data;
  }
}
