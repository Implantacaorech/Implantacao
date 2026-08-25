import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  AnaliseConsulta,
  CatalogoDados,
  ConfiguracaoConexao,
  PainelTokens,
  SondagemToken,
  TesteConexao,
  TokenApiDados,
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

  // ── Conexões (Portal API) ──────────────────────────────────────────────────────

  async configuracoesConexao(): Promise<ConfiguracaoConexao[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ConfiguracaoConexao[]>>(`${this.admin}/conexoes`),
    );
    return res.data;
  }

  async salvarConexao(
    chave: string,
    campos: Record<string, unknown>,
  ): Promise<ConfiguracaoConexao> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ConfiguracaoConexao>>(
        `${this.admin}/conexoes/${chave}`,
        campos,
      ),
    );
    return res.data;
  }

  async testarConexao(chave: string): Promise<TesteConexao> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<TesteConexao>>(
        `${this.admin}/conexoes/${chave}/testar`,
        {},
      ),
    );
    return res.data;
  }

  // ── Tokens do lado CONSUMIDOR (Portal Implantação) ─────────────────────────────

  async tokens(): Promise<PainelTokens> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<PainelTokens>>(`${this.base}/tokens`),
    );
    return res.data;
  }

  async sondarToken(url: string, chave: string): Promise<SondagemToken> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<SondagemToken>>(`${this.base}/tokens/sondar`, {
        url,
        chave,
      }),
    );
    return res.data;
  }

  async salvarToken(
    id: number | null,
    dto: {
      nome: string;
      url: string;
      chave?: string;
      consultas: string[];
      observacao?: string;
      ativo?: boolean;
    },
  ): Promise<TokenApiDados> {
    const res = await firstValueFrom(
      id === null
        ? this.http.post<ApiEnvelope<TokenApiDados>>(`${this.base}/tokens`, dto)
        : this.http.put<ApiEnvelope<TokenApiDados>>(
            `${this.base}/tokens/${id}`,
            dto,
          ),
    );
    return res.data;
  }

  async definirTokenAtivo(id: number, ativo: boolean): Promise<TokenApiDados> {
    const res = await firstValueFrom(
      this.http.patch<ApiEnvelope<TokenApiDados>>(
        `${this.base}/tokens/${id}/ativo`,
        { ativo },
      ),
    );
    return res.data;
  }

  async excluirToken(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.base}/tokens/${id}`));
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
