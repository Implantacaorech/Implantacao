import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  BuscaClientesProtocolo,
  CampoTextoProtocolo,
  ClienteComProtocolo,
  EnviarVisitaPortalPayload,
  EstadoGravacao,
  FichaProtocolo,
  FiltroProtocolos,
  GravacaoFinalizada,
  GravacaoIniciada,
  IniciarGravacaoPayload,
  ListaProtocolos,
  RascunhoVisita,
  ResultadoEnvioPortal,
  StatusCredencialPortal,
  StatusProcessamento,
} from '../models/protocolo.model';

/** De onde o navegador capta o áudio da reunião — ver core/audio/captura-audio.ts. */
export type FonteGravacao = 'microfone' | 'reuniao' | 'ambos';

@Injectable({ providedIn: 'root' })
export class ProtocoloService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/protocolos`;

  async listar(filtro: FiltroProtocolos = {}): Promise<ListaProtocolos> {
    let params = new HttpParams();
    for (const [chave, valor] of Object.entries(filtro)) {
      if (valor) params = params.set(chave, valor);
    }
    const r = await firstValueFrom(this.http.get<ApiEnvelope<ListaProtocolos>>(this.base, { params }));
    return r.data;
  }

  /** Clientes que já têm protocolo transcrito — seletor do "Preencher protocolo". */
  async clientesComProtocolo(): Promise<ClienteComProtocolo[]> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<{ itens: ClienteComProtocolo[] }>>(
        `${this.base}/clientes-com-protocolo`,
      ),
    );
    return r.data.itens;
  }

  /** Rascunho do "Registro de Atendimento em Visita" do Portal Rech, montado deste
   * protocolo — texto pronto para o consultor colar/conferir no Portal (Caminho A). */
  async rascunhoVisita(id: number): Promise<RascunhoVisita> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<RascunhoVisita>>(
        `${this.base}/${id}/rascunho-visita`,
      ),
    );
    return r.data;
  }

  // ---------------------------------------------- integração Portal Rech (por usuário)

  /** Status da credencial do Portal do usuário logado (tem? qual login?). */
  async credencialPortal(): Promise<StatusCredencialPortal> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<StatusCredencialPortal>>(
        `${this.base}/portal/credencial`,
      ),
    );
    return r.data;
  }

  async salvarCredencialPortal(
    login: string,
    senha: string,
  ): Promise<StatusCredencialPortal> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<StatusCredencialPortal>>(
        `${this.base}/portal/credencial`,
        { login, senha },
      ),
    );
    return r.data;
  }

  async removerCredencialPortal(): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/portal/credencial`));
  }

  /** Cria a visita (rascunho) no Portal a partir deste protocolo, com a credencial salva. */
  async enviarPortal(
    id: number,
    payload: EnviarVisitaPortalPayload,
  ): Promise<ResultadoEnvioPortal> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoEnvioPortal>>(
        `${this.base}/${id}/enviar-portal`,
        payload,
      ),
    );
    return r.data;
  }

  async enviar(arquivo: File): Promise<{ id: number; novo: boolean; aviso: string }> {
    const form = new FormData();
    form.append('video', arquivo);
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ id: number; novo: boolean; aviso: string }>>(`${this.base}/novo`, form),
    );
    return r.data;
  }

  async ficha(id: number): Promise<FichaProtocolo> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<FichaProtocolo>>(`${this.base}/${id}`));
    return r.data;
  }

  /** Define os NOMES dos locutores. Não reescreve a transcrição: o backend guarda o mapa
   * e devolve o texto já com os nomes aplicados (renomear é reversível). */
  async renomearLocutores(
    id: number,
    mapa: Record<string, string>,
  ): Promise<{ mapaLocutores: Record<string, string>; transcricao: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ mapaLocutores: Record<string, string>; transcricao: string }>>(
        `${this.base}/${id}/locutores`,
        { mapa },
      ),
    );
    return r.data;
  }

  async salvar(id: number, campos: Partial<Record<CampoTextoProtocolo, string>>): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/salvar`, campos));
  }

  async processar(id: number): Promise<{ iniciado: boolean; aviso: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ iniciado: boolean; aviso: string }>>(`${this.base}/${id}/processar`, {}),
    );
    return r.data;
  }

  /** Cancela o processamento em andamento (mata a transcrição no servidor e destrava o
   * protocolo, que volta para "Erro" e pode ser reprocessado). */
  async cancelarProcessamento(id: number): Promise<{ cancelado: boolean; aviso: string }> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<{ cancelado: boolean; aviso: string }>>(
        `${this.base}/${id}/cancelar`,
        {},
      ),
    );
    return r.data;
  }

  async aprovar(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/aprovar`, {}));
  }

  async reprovar(id: number): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/${id}/reprovar`, {}));
  }

  async excluir(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }

  async status(id: number): Promise<StatusProcessamento> {
    const r = await firstValueFrom(this.http.get<ApiEnvelope<StatusProcessamento>>(`${this.base}/${id}/status`));
    return r.data;
  }

  /** URL de STREAMING da mídia original, pronta para o `src` do player.
   *
   * Não devolve mais um Blob: baixar o arquivo inteiro (um vídeo de reunião passa de 180 MB)
   * significava esperar o download completo antes de o player mostrar qualquer coisa, segurar
   * tudo na memória do navegador e perder o "arrastar a barra". O `<video>` não manda
   * cabeçalho `Authorization`, então a rota de mídia é liberada por um TICKET curto e
   * específico daquele item — o token de sessão nunca entra na URL. */
  async videoUrl(id: number): Promise<string> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<{ ticket: string }>>(`${this.base}/${id}/video-ticket`),
    );
    return `${this.base}/${id}/video?t=${encodeURIComponent(r.data.ticket)}`;
  }

  // ------------------------------------------------------- gravação de reunião ao vivo

  /** Busca o cliente no SICLA — mesma consulta do Novo Cliente (passo 1). Mínimo de 2
   * caracteres; abaixo disso o backend devolve `ok:false` com a orientação. */
  async buscarClientes(termo: string): Promise<BuscaClientesProtocolo> {
    const params = new HttpParams().set('termo', termo);
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<BuscaClientesProtocolo>>(`${this.base}/clientes`, {
        params,
      }),
    );
    return r.data;
  }

  async iniciarGravacao(dados: IniciarGravacaoPayload): Promise<GravacaoIniciada> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<GravacaoIniciada>>(`${this.base}/gravacao`, dados),
    );
    return r.data;
  }

  /** Envia um trecho de áudio já capturado. `seq` mantém a ordem — é o que garante que a
   * transcrição saia na sequência certa mesmo se um envio demorar mais que o seguinte. */
  async enviarTrecho(id: number, seq: number, wav: Blob): Promise<void> {
    const form = new FormData();
    form.append('seq', String(seq));
    form.append('audio', wav, `trecho_${seq}.wav`);
    await firstValueFrom(this.http.post(`${this.base}/gravacao/${id}/trecho`, form));
  }

  async estadoGravacao(id: number): Promise<EstadoGravacao> {
    const r = await firstValueFrom(
      this.http.get<ApiEnvelope<EstadoGravacao>>(`${this.base}/gravacao/${id}`),
    );
    return r.data;
  }

  async finalizarGravacao(
    id: number,
    opcoes: { titulo?: string; retranscrever?: boolean } = {},
  ): Promise<GravacaoFinalizada> {
    const r = await firstValueFrom(
      this.http.post<ApiEnvelope<GravacaoFinalizada>>(
        `${this.base}/gravacao/${id}/finalizar`,
        opcoes,
      ),
    );
    return r.data;
  }

  async cancelarGravacao(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/gravacao/${id}`));
  }
}
