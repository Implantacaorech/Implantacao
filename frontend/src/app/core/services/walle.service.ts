import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  ArquivoWalle,
  ChatWalle,
  FiltrosWalle,
  RespostaBuscaWalle,
  RespostaIaWalle,
  StatusAcervoWalle,
  VisaoChatWalle,
} from '../models/walle.model';

/** API da tela Execução → Wall-e. Toda leitura vem do índice no banco do Painel — a fonte
 * (`R:\GRM\CHAT_WALLE\`) é somente leitura e só o backend a toca, para ler. */
@Injectable({ providedIn: 'root' })
export class WalleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/walle`;

  async status(): Promise<StatusAcervoWalle> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<StatusAcervoWalle>>(`${this.base}/status`),
    );
    return res.data;
  }

  /** Reindexação (exige nível `alteracao` no menu `walle`). */
  async atualizar(): Promise<StatusAcervoWalle> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<StatusAcervoWalle>>(`${this.base}/atualizar`, {}),
    );
    return res.data;
  }

  async pesquisar(filtros: FiltrosWalle): Promise<RespostaBuscaWalle> {
    let params = new HttpParams();
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.chat !== undefined) params = params.set('chat', filtros.chat);
    if (filtros.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros.origem) params = params.set('origem', filtros.origem);
    if (filtros.assunto) params = params.set('assunto', filtros.assunto);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<RespostaBuscaWalle>>(`${this.base}/busca`, { params }),
    );
    const d = res.data;
    return {
      ...d,
      resultados: d.resultados ?? [],
      assuntosRelacionados: d.assuntosRelacionados ?? [],
      tambemPodeSerUtil: d.tambemPodeSerUtil ?? [],
      sqlsRelacionados: d.sqlsRelacionados ?? [],
      sugestoes: d.sugestoes ?? [],
    };
  }

  /** Pergunta em linguagem natural (busca + síntese por IA local; degrada para fontes). */
  async perguntar(q: string): Promise<RespostaIaWalle> {
    const params = new HttpParams().set('q', q);
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<RespostaIaWalle>>(`${this.base}/pergunta`, { params }),
    );
    return res.data;
  }

  async chats(): Promise<ChatWalle[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ChatWalle[]>>(`${this.base}/chats`),
    );
    return res.data ?? [];
  }

  async visaoChat(codigo: number): Promise<VisaoChatWalle> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<VisaoChatWalle>>(`${this.base}/chats/${codigo}`),
    );
    return res.data;
  }

  async arquivo(id: number): Promise<ArquivoWalle> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<ArquivoWalle>>(`${this.base}/arquivos/${id}`),
    );
    return res.data;
  }

  /** Imagem do acervo como blob (o endpoint exige JWT — `<img src>` direto não manda o
   * cabeçalho; o componente transforma em object URL). */
  async imagem(id: number): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`${this.base}/arquivos/${id}/imagem`, { responseType: 'blob' }),
    );
  }
}
