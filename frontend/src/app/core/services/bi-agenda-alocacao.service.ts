import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  FiltroCalendarioAlocacaoBi,
  FiltroHorasAplicadasBi,
  ResultadoCalendarioAlocacaoBi,
  ResultadoHorasAplicadasBi,
} from '../models/bi-agenda-alocacao.model';

@Injectable({ providedIn: 'root' })
export class BiAgendaAlocacaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bi-agenda-alocacao`;

  /** Blindagem contra bundle novo x backend antigo (ver BiImplantacaoService.listas). */
  private listas<T>(o: T | undefined, chaves: string[]): T {
    const base = { ...(o ?? {}) } as Record<string, unknown>;
    for (const k of chaves) if (!Array.isArray(base[k])) base[k] = [];
    return base as T;
  }

  async calendario(filtro: FiltroCalendarioAlocacaoBi = {}): Promise<ResultadoCalendarioAlocacaoBi> {
    let params = new HttpParams();
    if (filtro.mes) params = params.set('mes', filtro.mes);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.responsavel ?? []) params = params.append('responsavel', v);
    for (const v of filtro.tipoSuporte ?? []) params = params.append('tipoSuporte', v);
    for (const v of filtro.status ?? []) params = params.append('status', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoCalendarioAlocacaoBi>>(`${this.base}/calendario`, { params }),
    );
    const d = res.data;
    const chaves = ['grupos', 'responsaveis', 'tiposSuporte', 'status'];
    return {
      ...d,
      dias: d.dias ?? [],
      resumo: d.resumo ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }

  async horasAplicadas(filtro: FiltroHorasAplicadasBi = {}): Promise<ResultadoHorasAplicadasBi> {
    let params = new HttpParams();
    if (filtro.compIni) params = params.set('compIni', filtro.compIni);
    if (filtro.compFim) params = params.set('compFim', filtro.compFim);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.responsavel ?? []) params = params.append('responsavel', v);
    for (const v of filtro.tipoSuporte ?? []) params = params.append('tipoSuporte', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoHorasAplicadasBi>>(`${this.base}/horas-aplicadas`, { params }),
    );
    const d = res.data;
    const chaves = ['grupos', 'responsaveis', 'tiposSuporte'];
    return {
      ...d,
      linhas: d.linhas ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }
}
