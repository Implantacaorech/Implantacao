import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  FiltroIndicadoresBi,
  ResultadoIndicadoresBi,
} from '../models/bi-indicadores.model';

@Injectable({ providedIn: 'root' })
export class BiIndicadoresService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bi-indicadores`;

  async indicadores(filtro: FiltroIndicadoresBi = {}): Promise<ResultadoIndicadoresBi> {
    let params = new HttpParams();
    if (filtro.compIni) params = params.set('compIni', filtro.compIni);
    if (filtro.compFim) params = params.set('compFim', filtro.compFim);
    for (const v of filtro.posicao ?? []) params = params.append('posicao', v);
    for (const v of filtro.tipoImplantacao ?? []) params = params.append('tipoImplantacao', v);
    for (const v of filtro.area ?? []) params = params.append('area', v);
    for (const v of filtro.tipoSuporte ?? []) params = params.append('tipoSuporte', v);
    for (const v of filtro.responsavel ?? []) params = params.append('responsavel', v);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoIndicadoresBi>>(this.base, { params }),
    );
    const d = res.data;
    // Blindagem contra bundle novo x backend antigo (ver BiImplantacaoService.listas).
    const listas = (o: Record<string, unknown> | undefined, chaves: string[]) => {
      const base = { ...(o ?? {}) } as Record<string, unknown>;
      for (const k of chaves) if (!Array.isArray(base[k])) base[k] = [];
      return base;
    };
    const chaves = ['posicoes', 'tiposImplantacao', 'areas', 'tiposSuporte', 'responsaveis', 'grupos'];
    return {
      ...d,
      linhas: d.linhas ?? [],
      porMesContratacao: d.porMesContratacao ?? [],
      porMesConclusao: d.porMesConclusao ?? [],
      porPosicao: d.porPosicao ?? [],
      porTipo: d.porTipo ?? [],
      porResponsavel: d.porResponsavel ?? [],
      filtros: listas(d.filtros as never, chaves) as never,
      selecionados: listas(d.selecionados as never, chaves) as never,
    };
  }
}
