import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  DescricaoCompletaBi,
  EnvioVisitasEmailBi,
  FiltroExtratoBi,
  FiltroResumoBi,
  FiltroRnsBi,
  FiltroAgendasBi,
  FiltroVisitasPortalBi,
  ModeloEmailVisitasBi,
  ResultadoExtratoBi,
  ResultadoResumoBi,
  ResultadoRnsBi,
  ResultadoAgendasBi,
  ResultadoVisitasPortalBi,
} from '../models/bi-implantacao.model';

@Injectable({ providedIn: 'root' })
export class BiImplantacaoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/bi-implantacao`;

  /** Completa listas ausentes do payload.
   *
   * O Painel roda backend e frontend no MESMO processo, mas o navegador pode estar com um
   * bundle mais novo que o processo no ar (basta não ter reiniciado após o deploy). Aí um
   * filtro novo chega `undefined` e o template quebra ao iterar — apagando a tela inteira em
   * vez de só faltar um filtro. Normalizar aqui mantém a tela de pé no meio-termo. */
  private listas<T>(o: T | undefined, chaves: string[]): T {
    const base = { ...(o ?? {}) } as Record<string, unknown>;
    for (const k of chaves) if (!Array.isArray(base[k])) base[k] = [];
    return base as T;
  }

  async resumo(filtro: FiltroResumoBi = {}): Promise<ResultadoResumoBi> {
    let params = new HttpParams();
    if (filtro.dataIni) params = params.set('dataIni', filtro.dataIni);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.status ?? []) params = params.append('status', v);
    for (const v of filtro.tecnico ?? []) params = params.append('tecnico', v);
    for (const v of filtro.ativo ?? []) params = params.append('ativo', v);
    for (const v of filtro.tipoCliente ?? []) params = params.append('tipoCliente', v);
    for (const v of filtro.rns ?? []) params = params.append('rns', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoResumoBi>>(`${this.base}/resumo`, { params }),
    );
    const d = res.data;
    const chaves = ['grupos', 'status', 'tecnicos', 'ativos', 'tiposCliente', 'rns'];
    return {
      ...d,
      linhas: d.linhas ?? [],
      porStatus: d.porStatus ?? [],
      porTecnico: d.porTecnico ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }

  /** Painel "Visitas do Portal Rech" do Resumo — SQL editável no Consultas BD
   * (slug `bi_visitas_portal`); o recorte de período é o mesmo De/Até da tela. */
  async visitasPortal(
    filtro: FiltroVisitasPortalBi = {},
  ): Promise<ResultadoVisitasPortalBi> {
    let params = new HttpParams();
    if (filtro.dataIni) params = params.set('dataIni', filtro.dataIni);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoVisitasPortalBi>>(
        `${this.base}/visitas-portal`,
        { params },
      ),
    );
    const d = res.data;
    return { ...d, linhas: d.linhas ?? [] };
  }

  /** Assunto/corpo padrão da caixa "Enviar por e-mail" do painel de visitas. */
  async modeloEmailVisitas(): Promise<ModeloEmailVisitasBi> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ModeloEmailVisitasBi>>(
        `${this.base}/visitas-portal/modelo-email`,
      ),
    );
    return res.data;
  }

  /** Envia o painel de visitas por e-mail — o backend gera o PDF (recorte + gráfico +
   * tabela) e anexa. */
  async enviarVisitasEmail(
    envio: EnvioVisitasEmailBi,
  ): Promise<{ ok: boolean; erro: string | null }> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ ok: boolean; erro: string | null }>>(
        `${this.base}/visitas-portal/enviar-email`,
        envio,
      ),
    );
    return res.data;
  }

  async extrato(filtro: FiltroExtratoBi = {}): Promise<ResultadoExtratoBi> {
    let params = new HttpParams();
    if (filtro.dataIni) params = params.set('dataIni', filtro.dataIni);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.tecnico ?? []) params = params.append('tecnico', v);
    for (const v of filtro.sigla ?? []) params = params.append('sigla', v);
    for (const v of filtro.cliente ?? []) params = params.append('cliente', v);
    for (const v of filtro.status ?? []) params = params.append('status', v);
    for (const v of filtro.rns ?? []) params = params.append('rns', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoExtratoBi>>(`${this.base}/extrato`, { params }),
    );
    const d = res.data;
    const chaves = ['grupos', 'tecnicos', 'siglas', 'clientes', 'status', 'rns'];
    return {
      ...d,
      linhas: d.linhas ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }

  async rns(filtro: FiltroRnsBi = {}): Promise<ResultadoRnsBi> {
    let params = new HttpParams();
    if (filtro.dataIni) params = params.set('dataIni', filtro.dataIni);
    if (filtro.dataFim) params = params.set('dataFim', filtro.dataFim);
    if (filtro.validada) params = params.set('validada', filtro.validada);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.status ?? []) params = params.append('status', v);
    for (const v of filtro.tecnico ?? []) params = params.append('tecnico', v);
    for (const v of filtro.sigla ?? []) params = params.append('sigla', v);
    for (const v of filtro.tipo ?? []) params = params.append('tipo', v);
    for (const v of filtro.statusImplantacao ?? [])
      params = params.append('statusImplantacao', v);
    for (const v of filtro.rns ?? []) params = params.append('rns', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoRnsBi>>(`${this.base}/rns`, { params }),
    );
    const d = res.data;
    const chaves = [
      'grupos', 'status', 'tecnicos', 'siglas', 'tipos', 'statusImplantacao', 'rns',
    ];
    return {
      ...d,
      linhas: d.linhas ?? [],
      porStatus: d.porStatus ?? [],
      porSigla: d.porSigla ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }

  async agendas(filtro: FiltroAgendasBi = {}): Promise<ResultadoAgendasBi> {
    let params = new HttpParams();
    if (filtro.mes) params = params.set('mes', filtro.mes);
    for (const v of filtro.grupo ?? []) params = params.append('grupo', v);
    for (const v of filtro.tecnico ?? []) params = params.append('tecnico', v);
    for (const v of filtro.status ?? []) params = params.append('status', v);
    for (const v of filtro.statusImplantacao ?? [])
      params = params.append('statusImplantacao', v);
    for (const v of filtro.rns ?? []) params = params.append('rns', v);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ResultadoAgendasBi>>(`${this.base}/agendas`, { params }),
    );
    const d = res.data;
    const chaves = ['grupos', 'tecnicos', 'statusImplantacao', 'status', 'rns'];
    return {
      ...d,
      dias: d.dias ?? [],
      resumo: d.resumo ?? [],
      filtros: this.listas(d.filtros, chaves),
      selecionados: this.listas(d.selecionados, chaves),
    };
  }

  /** Texto completo da descrição de um lançamento — a listagem traz só a prévia. */
  async descricao(protocolo: number, datahora: string): Promise<DescricaoCompletaBi> {
    const params = new HttpParams()
      .set('protocolo', String(protocolo))
      .set('datahora', datahora);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<DescricaoCompletaBi>>(`${this.base}/extrato/descricao`, {
        params,
      }),
    );
    return res.data;
  }
}
