import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  AtividadeCronograma,
  CronogramaConfigDto,
  Designacao,
  HorariosPorTurno,
  PeriodoBloqueado,
  Prontidao,
  ResultadoDistribuicao,
  VisitaAgrupada,
} from '../models/cronograma.model';

@Injectable({ providedIn: 'root' })
export class CronogramaService {
  private readonly http = inject(HttpClient);

  private base(projetoId: number): string {
    return `${environment.apiUrl}/projetos/${projetoId}/agenda`;
  }

  async atividades(projetoId: number): Promise<AtividadeCronograma[]> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<AtividadeCronograma[]>>(`${this.base(projetoId)}/atividades`));
    return r.data;
  }

  async visitas(projetoId: number): Promise<VisitaAgrupada[]> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<VisitaAgrupada[]>>(`${this.base(projetoId)}/visitas`));
    return r.data;
  }

  async designacoes(projetoId: number): Promise<Designacao[]> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<Designacao[]>>(`${this.base(projetoId)}/designacoes`));
    return r.data;
  }

  async salvarDesignacao(
    projetoId: number,
    dto: { modulo: string; tecnico?: string; ordem?: number; naoDistribuir?: boolean; analista?: string },
  ): Promise<void> {
    await firstValueFrom(this.http.put(`${this.base(projetoId)}/designacoes`, dto));
  }

  async horarios(projetoId: number): Promise<HorariosPorTurno> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<HorariosPorTurno>>(`${this.base(projetoId)}/horarios`));
    return r.data;
  }

  async salvarHorario(projetoId: number, turno: string, horaInicio: string, horaFim: string): Promise<void> {
    await firstValueFrom(this.http.put(`${this.base(projetoId)}/horarios`, { turno, horaInicio, horaFim }));
  }

  async config(projetoId: number): Promise<CronogramaConfigDto> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<CronogramaConfigDto>>(`${this.base(projetoId)}/config`));
    return r.data;
  }

  async salvarConfig(
    projetoId: number,
    dto: { modo?: string; dataInicio?: string; diasExcluidos?: { diaSemana: number; turno: string }[]; analistaPadrao?: string },
  ): Promise<CronogramaConfigDto> {
    const r = await firstValueFrom(this.http.put<ApiEnvelope<CronogramaConfigDto>>(`${this.base(projetoId)}/config`, dto));
    return r.data;
  }

  async periodos(projetoId: number): Promise<PeriodoBloqueado[]> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<PeriodoBloqueado[]>>(`${this.base(projetoId)}/periodos`));
    return r.data;
  }

  async criarPeriodo(
    projetoId: number,
    dto: { dataIni: string; dataFim: string; motivo?: string; tecnicos?: string[] },
  ): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base(projetoId)}/periodos`, dto));
  }

  async excluirPeriodo(projetoId: number, periodoId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base(projetoId)}/periodos/${periodoId}`));
  }

  async bloqueios(projetoId: number, inicio: string, fim: string): Promise<Record<string, string>> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<Record<string, string>>>(`${this.base(projetoId)}/bloqueios`, {
        params: { inicio, fim },
      }),
    );
    return r.data;
  }

  async prontidao(projetoId: number): Promise<Prontidao> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<Prontidao>>(`${this.base(projetoId)}/prontidao`));
    return r.data;
  }

  async alocar(
    projetoId: number,
    atividadeId: number,
    dto: { data?: string; turno?: string; tecnico?: string },
  ): Promise<AtividadeCronograma> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<AtividadeCronograma>>(`${this.base(projetoId)}/alocar/${atividadeId}`, dto),
    );
    return r.data;
  }

  async alocarVisita(projetoId: number, modulo: string, seq: number, data?: string, turno?: string): Promise<number> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ n: number }>>(`${this.base(projetoId)}/alocar-visita`, { modulo, seq, data, turno }),
    );
    return r.data.n;
  }

  async distribuir(projetoId: number): Promise<ResultadoDistribuicao> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoDistribuicao>>(`${this.base(projetoId)}/distribuir`, {}),
    );
    return r.data;
  }

  async redistribuir(projetoId: number): Promise<ResultadoDistribuicao> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoDistribuicao>>(`${this.base(projetoId)}/redistribuir`, {}),
    );
    return r.data;
  }

  async desfazerTudo(projetoId: number): Promise<{ ok: boolean; erro?: string; n?: number; aviso?: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ ok: boolean; erro?: string; n?: number; aviso?: string }>>(
        `${this.base(projetoId)}/desfazer-tudo`,
        {},
      ),
    );
    return r.data;
  }

  async reorganizarModulo(projetoId: number, modulo: string): Promise<ResultadoDistribuicao> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoDistribuicao>>(`${this.base(projetoId)}/reorganizar-modulo`, { modulo }),
    );
    return r.data;
  }

  async status(projetoId: number, atividadeId: number, status: string): Promise<AtividadeCronograma> {
    const r = await firstValueFrom(
      this.http.put<ApiEnvelope<AtividadeCronograma>>(`${this.base(projetoId)}/atividades/${atividadeId}/status`, {
        status,
      }),
    );
    return r.data;
  }

  async postergar(
    projetoId: number,
    dto: { atividadeId?: number; data?: string; turno?: string; novaData: string; novoTurno: string },
  ): Promise<number> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ n: number }>>(`${this.base(projetoId)}/postergar`, dto),
    );
    return r.data.n;
  }

  async postergarVisita(
    projetoId: number,
    dto: { modulo: string; seq: number; novaData: string; novoTurno: string },
  ): Promise<number> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ n: number }>>(`${this.base(projetoId)}/postergar-visita`, dto),
    );
    return r.data.n;
  }

  async atividadeExcluir(projetoId: number, atividadeId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base(projetoId)}/atividades/${atividadeId}`));
  }

  async gerarXlsx(projetoId: number): Promise<{ blob: Blob; filename: string }> {
    const res = await firstValueFrom(
      this.http.post(`${this.base(projetoId)}/gerar`, null, { responseType: 'blob', observe: 'response' }),
    );
    const m = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '');
    return { blob: res.body as Blob, filename: m?.[1] ?? 'cronograma.xlsx' };
  }
}
