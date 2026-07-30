import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  FiltroMovimentosBi,
  ResultadoMovimentosBi,
} from '../models/bi-movimentos.model';

@Injectable({ providedIn: 'root' })
export class BiMovimentosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bi-movimentos`;

  /** Blindagem contra bundle novo x backend antigo (ver BiImplantacaoService.listas). */
  private listas<T>(o: T | undefined, chaves: string[]): T {
    const base = { ...(o ?? {}) } as Record<string, unknown>;
    for (const k of chaves) if (!Array.isArray(base[k])) base[k] = [];
    return base as T;
  }

  async movimentos(filtro: FiltroMovimentosBi = {}): Promise<ResultadoMovimentosBi> {
    let params = new HttpParams();
    if (filtro.dataIni) params = params.set('dataIni', filtro.dataIni);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    for (const v of filtro.tecnico ?? []) params = params.append('tecnico', v);
    for (const v of filtro.tpMovimento ?? []) params = params.append('tpMovimento', v);
    for (const v of filtro.cobraHora ?? []) params = params.append('cobraHora', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoMovimentosBi>>(this.base, { params }),
    );
    const d = res.data;
    const chaves = ['tecnicos', 'tiposMovimento'];
    return {
      ...d,
      porTecnico: d.porTecnico ?? [],
      porTpMovimento: d.porTpMovimento ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }
}
