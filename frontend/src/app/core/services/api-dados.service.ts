import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  CatalogoDados,
  ClienteApi,
  ClienteApiCriado,
  EstadoConexao,
  MetricaConsulta,
} from '../models/api-dados.model';

/** Cliente da API de Dados (ADR-0003). As rotas `/admin/*` exigem perfil ADM e vão sempre
 * pelo JWT da pessoa — nunca por chave de máquina: uma chave comprometida não emite outra. */
@Injectable({ providedIn: 'root' })
export class ApiDadosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/dados/v1`;
  private readonly admin = `${environment.apiUrl}/dados/v1/admin`;

  async catalogo(): Promise<CatalogoDados> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<CatalogoDados>>(`${this.base}/consultas`),
    );
    return res.data;
  }

  async conexoes(): Promise<EstadoConexao[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<EstadoConexao[]>>(`${this.base}/conexoes`),
    );
    return res.data;
  }

  async clientes(): Promise<ClienteApi[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ClienteApi[]>>(`${this.admin}/clientes`),
    );
    return res.data;
  }

  async escopos(): Promise<string[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<string[]>>(`${this.admin}/clientes/escopos`),
    );
    return res.data;
  }

  async criarCliente(dto: {
    nome: string;
    escopos: string[];
    observacao?: string;
  }): Promise<ClienteApiCriado> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ClienteApiCriado>>(`${this.admin}/clientes`, dto),
    );
    return res.data;
  }

  async definirAtivo(id: number, ativo: boolean): Promise<ClienteApi> {
    const res = await firstValueFrom(
      this.http.patch<ApiEnvelope<ClienteApi>>(`${this.admin}/clientes/${id}/ativo`, { ativo }),
    );
    return res.data;
  }

  async rotacionar(id: number): Promise<ClienteApiCriado> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ClienteApiCriado>>(`${this.admin}/clientes/${id}/rotacionar`, {}),
    );
    return res.data;
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.admin}/clientes/${id}`));
  }

  async metricas(): Promise<MetricaConsulta[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<MetricaConsulta[]>>(`${this.admin}/metricas`),
    );
    return res.data;
  }

  async limparCache(): Promise<number> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ descartadas: number }>>(`${this.admin}/cache/limpar`, {}),
    );
    return res.data.descartadas;
  }
}
