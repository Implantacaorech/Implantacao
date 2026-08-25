import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  AnaliseConsulta,
  CatalogoDados,
  ClienteApi,
  ClienteApiCriado,
  ConsultaPublicadaResumo,
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

  /** Universo de consultas que um token pode autorizar (o catálogo). */
  async consultasDisponiveis(): Promise<string[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<string[]>>(
        `${this.admin}/clientes/consultas-disponiveis`,
      ),
    );
    return res.data;
  }

  async criarCliente(dto: {
    nome: string;
    consultas: string[];
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

  // ── Consultas criadas pela tela ────────────────────────────────────────────────

  async listarConsultas(): Promise<ConsultaPublicadaResumo[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ConsultaPublicadaResumo[]>>(
        `${this.admin}/consultas`,
      ),
    );
    return res.data;
  }

  async obterConsulta(slug: string): Promise<ConsultaPublicadaResumo> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ConsultaPublicadaResumo>>(
        `${this.admin}/consultas/${slug}`,
      ),
    );
    return res.data;
  }

  /** "Testar": roda o SELECT com limite 1 e devolve binds, colunas e uma amostra. */
  async analisarConsulta(dto: {
    conexao: string;
    sql: string;
    exemplos?: Record<string, unknown>;
  }): Promise<AnaliseConsulta> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<AnaliseConsulta>>(
        `${this.admin}/consultas/analisar`,
        dto,
      ),
    );
    return res.data;
  }

  async salvarConsulta(dto: ConsultaPublicadaResumo): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ slug: string }>>(`${this.admin}/consultas`, dto),
    );
    return res.data.slug;
  }

  async excluirConsulta(slug: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.admin}/consultas/${slug}`),
    );
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
