import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import {
  AvisoAtividade,
  CartaoAtividade,
  ConsultorPainel,
  ContatoCliente,
  Etiqueta,
  ListaDeQuadros,
  ProjetoDisponivel,
  PreviaTrello,
  QuadroCompleto,
  ResultadoBuscaAtividades,
  ResultadoImportacao,
} from '../models/controle-atividades.model';

/** Integração da tela Execução → Controle de Atividades. Quem conhece rota, verbo e
 * envelope é este service — o componente só chama método (conformidade do Guia Mestre
 * adaptada ao Angular). */
@Injectable({ providedIn: 'root' })
export class ControleAtividadesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/atividades`;

  private async get<T>(rota: string, params?: HttpParams): Promise<T> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<T>>(`${this.base}${rota}`, { params }),
    );
    return res.data;
  }

  // ------------------------------------------------------------------ quadros

  async quadros(): Promise<ListaDeQuadros> {
    const d = await this.get<ListaDeQuadros>('/quadros');
    // Blindagem contra bundle novo x backend antigo, no mesmo idioma dos services de BI.
    return { meus: d.meus ?? [], demais: d.demais ?? [], consultores: d.consultores ?? [] };
  }

  async projetosDisponiveis(): Promise<ProjetoDisponivel[]> {
    return (await this.get<ProjetoDisponivel[]>('/projetos-disponiveis')) ?? [];
  }

  async abrirQuadro(
    codigoClienteSicla: string,
    nomeCliente: string,
    projetoId: number,
  ): Promise<{ codigoClienteSicla: string }> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<{ codigoClienteSicla: string }>>(`${this.base}/quadros`, {
        codigoClienteSicla,
        nomeCliente,
        projetoId,
      }),
    );
    return res.data;
  }

  async quadro(codigo: string): Promise<QuadroCompleto> {
    const d = await this.get<QuadroCompleto>(`/quadros/${encodeURIComponent(codigo)}`);
    return { ...d, listas: d.listas ?? [], cartoes: d.cartoes ?? [] };
  }

  async incluirResponsavel(codigo: string, usuarioId: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/quadros/${encodeURIComponent(codigo)}/responsaveis`, {
        usuarioId,
      }),
    );
  }

  async removerResponsavel(codigo: string, usuarioId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(
        `${this.base}/quadros/${encodeURIComponent(codigo)}/responsaveis/${usuarioId}`,
      ),
    );
  }

  async sincronizarResponsaveis(codigo: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${this.base}/quadros/${encodeURIComponent(codigo)}/responsaveis/sincronizar`,
        {},
      ),
    );
  }

  // ------------------------------------------------------------------ colunas

  async criarLista(codigo: string, titulo: string, visivelCliente: boolean): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/quadros/${encodeURIComponent(codigo)}/listas`, {
        titulo,
        visivelCliente,
      }),
    );
  }

  async editarLista(
    id: number,
    dados: { titulo?: string; visivelCliente?: boolean },
  ): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/listas/${id}`, dados));
  }

  async removerLista(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/listas/${id}`));
  }

  // ------------------------------------------------------------------ cartões

  async criarCartao(dados: {
    listaId: number;
    titulo: string;
    descricao?: string;
    prazo?: string;
    etiquetas?: string[];
    designadoUsuarioId?: number;
  }): Promise<CartaoAtividade> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<CartaoAtividade>>(`${this.base}/cartoes`, dados),
    );
    return res.data;
  }

  async editarCartao(
    id: number,
    dados: { titulo?: string; descricao?: string; prazo?: string; etiquetas?: string[] },
  ): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.base}/cartoes/${id}`, dados));
  }

  async moverCartao(id: number, listaId: number, indice: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.base}/cartoes/${id}/mover`, { listaId, indice }),
    );
  }

  async definirVisibilidade(id: number, visivelCliente: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.base}/cartoes/${id}/visibilidade`, { visivelCliente }),
    );
  }

  async arquivarCartao(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/cartoes/${id}`));
  }

  // ------------------------------------------------------- membros / checklist

  async incluirMembro(
    cartaoId: number,
    dados: {
      tipo: 'interno' | 'cliente';
      usuarioId?: number;
      nome: string;
      email?: string;
      cargo?: string;
    },
  ): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/cartoes/${cartaoId}/membros`, dados));
  }

  async removerMembro(cartaoId: number, membroId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/cartoes/${cartaoId}/membros/${membroId}`),
    );
  }

  async incluirItem(cartaoId: number, texto: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/cartoes/${cartaoId}/checklist`, { texto }),
    );
  }

  async marcarItem(cartaoId: number, itemId: number, feito: boolean): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.base}/cartoes/${cartaoId}/checklist/${itemId}`, { feito }),
    );
  }

  async removerItem(cartaoId: number, itemId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/cartoes/${cartaoId}/checklist/${itemId}`),
    );
  }

  // ------------------------------------------------------- anexos / comentários

  async anexar(cartaoId: number, arquivo: File): Promise<void> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    await firstValueFrom(
      this.http.post(`${this.base}/cartoes/${cartaoId}/anexos`, form),
    );
  }

  async anexarLink(cartaoId: number, url: string, nome?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/cartoes/${cartaoId}/anexos/link`, { url, nome }),
    );
  }

  /** URL de download — a rota confere a permissão do cartão a cada entrega. */
  urlAnexo(cartaoId: number, anexoId: number): string {
    return `${this.base}/cartoes/${cartaoId}/anexos/${anexoId}`;
  }

  /** Baixa o anexo pelo HttpClient (o interceptor põe o Bearer) e salva pelo navegador.
   * Um `<a href>` direto não carrega o token e voltaria 401. */
  async baixarAnexo(cartaoId: number, anexoId: number, nome: string): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(this.urlAnexo(cartaoId, anexoId), { responseType: 'blob' }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  async removerAnexo(cartaoId: number, anexoId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.base}/cartoes/${cartaoId}/anexos/${anexoId}`),
    );
  }

  async comentar(cartaoId: number, texto: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/cartoes/${cartaoId}/comentarios`, { texto }),
    );
  }

  // ------------------------------------------------------------ busca / avisos

  async buscar(termo: string, consultorId?: number): Promise<ResultadoBuscaAtividades> {
    let params = new HttpParams().set('termo', termo);
    if (consultorId) params = params.set('consultor', String(consultorId));
    const d = await this.get<ResultadoBuscaAtividades>('/busca', params);
    return { ...d, achados: d.achados ?? [] };
  }

  async avisos(): Promise<AvisoAtividade[]> {
    return (await this.get<AvisoAtividade[]>('/notificacoes')) ?? [];
  }

  async fecharAvisos(ids?: number[]): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.base}/notificacoes/lidas`, { ids: ids ?? [] }),
    );
  }

  // ------------------------------------------------------- importar do Trello

  /** Lê o arquivo e devolve o que ENTRARIA. Não grava nada — a confirmação é outra chamada. */
  async previaTrello(codigo: string, arquivo: File): Promise<PreviaTrello> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<PreviaTrello>>(
        `${this.base}/quadros/${encodeURIComponent(codigo)}/importar/trello/previa`,
        form,
      ),
    );
    const d = res.data;
    return { ...d, listas: d.listas ?? [], avisos: d.avisos ?? [], colunasDoQuadro: d.colunasDoQuadro ?? [] };
  }

  /** Importa de verdade, com o de/para de colunas confirmado na prévia. */
  async importarTrello(
    codigo: string,
    arquivo: File,
    destinos: { idListaTrello: string; listaId?: number }[],
  ): Promise<ResultadoImportacao> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    // JSON num campo ÚNICO: num multipart, campo repetido com notação de colchetes chega ao
    // backend como chave literal (o multer não interpreta), e o de/para viria vazio.
    form.append('destinos', JSON.stringify(destinos));
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<ResultadoImportacao>>(
        `${this.base}/quadros/${encodeURIComponent(codigo)}/importar/trello`,
        form,
      ),
    );
    return res.data;
  }

  // ------------------------------------------------------------------- apoio

  async etiquetas(): Promise<Etiqueta[]> {
    return (await this.get<Etiqueta[]>('/etiquetas')) ?? [];
  }

  async consultores(): Promise<ConsultorPainel[]> {
    return (await this.get<ConsultorPainel[]>('/consultores')) ?? [];
  }

  /** Busca de cliente no SICLA — o projeto guarda o NOME, e o quadro é chaveado pelo
   * CÓDIGO; é aqui que se resolve um no outro. */
  async clientesSicla(termo: string): Promise<{ codigo: string; cliente: string }[]> {
    const params = new HttpParams().set('termo', termo);
    const d = await this.get<{ clientes?: { codigo: string; cliente: string }[] }>(
      '/clientes',
      params,
    );
    return d?.clientes ?? [];
  }

  async contatos(codigo: string): Promise<ContatoCliente[]> {
    const d = await this.get<{ contatos?: ContatoCliente[] }>(
      `/contatos/${encodeURIComponent(codigo)}`,
    );
    return d?.contatos ?? [];
  }
}
