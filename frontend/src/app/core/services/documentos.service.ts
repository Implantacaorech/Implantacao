import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { Documento, EventoProjeto, SlugDocumentoFiel } from '../models/documento.model';
import { Cabecalho } from '../models/painel.model';
import { Projeto } from '../models/projeto.model';

export interface ArquivoBaixado {
  blob: Blob;
  filename: string;
}

export type PreviewDocumento = { tipo: 'pdf'; blob: Blob } | { tipo: 'html'; html: string };

export interface LevantamentoImportado {
  arquivo: string;
  criadoEm: string;
}

export interface ArquivoGeradoComRespostas extends ArquivoBaixado {
  respostasImportadas: number;
}

function nomeArquivo(contentDisposition: string | null, fallback: string): string {
  const m = /filename="?([^";]+)"?/.exec(contentDisposition ?? '');
  return m?.[1] ?? fallback;
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  async listar(projetoId: number): Promise<Documento[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Documento[]>>(`${this.base}/projetos/${projetoId}/documentos`),
    );
    return res.data;
  }

  async eventos(projetoId: number): Promise<EventoProjeto[]> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<EventoProjeto[]>>(`${this.base}/projetos/${projetoId}/eventos`),
    );
    return res.data;
  }

  async gerarLayout(
    projetoId: number,
    slug: SlugDocumentoFiel,
    modo?: 'auto' | 'modelo',
  ): Promise<ArquivoBaixado> {
    const params = modo ? { modo } : undefined;
    const res = await firstValueFrom(
      this.http.post(`${this.base}/projetos/${projetoId}/gerar-layout/${slug}`, null, {
        params,
        responseType: 'blob',
        observe: 'response',
      }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), `${slug}`),
    };
  }

  async baixar(documentoId: number, nomeSugerido: string): Promise<ArquivoBaixado> {
    const res = await firstValueFrom(
      this.http.get(`${this.base}/documentos/${documentoId}/baixar`, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), nomeSugerido),
    };
  }

  /** PDF fiel (Word COM) quando disponível, senão HTML — equivalente a
   * webapp/routes_fluxo.py:projeto_doc_ver. Sempre pede como blob: uma resposta JSON
   * também chega como Blob (texto), que é lido e parseado manualmente. */
  async preview(documentoId: number): Promise<PreviewDocumento> {
    const res = await firstValueFrom(
      this.http.get(`${this.base}/documentos/${documentoId}/preview`, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const contentType = res.headers.get('content-type') ?? '';
    const blob = res.body as Blob;
    if (contentType.includes('application/pdf')) {
      return { tipo: 'pdf', blob };
    }
    const texto = await blob.text();
    const dados = JSON.parse(texto) as { tipo: 'html'; html: string };
    return { tipo: 'html', html: dados.html };
  }

  /** Há um Levantamento (.docx) importado neste projeto? — equivalente a
   * webapp/db.py:levantamento_importado, exposto pra tela "Projeto origem" decidir se
   * mostra a opção "Usar o Levantamento importado". */
  async origemProjeto(projetoId: number): Promise<{ importado: LevantamentoImportado | null }> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<{ importado: LevantamentoImportado | null }>>(
        `${this.base}/projetos/${projetoId}/projeto/origem`,
      ),
    );
    return res.data;
  }

  /** Importa as respostas de um Levantamento (.docx enviado agora, ou `null` para reusar o
   * último já importado) e gera o Projeto — equivalente a
   * webapp/routes_geracao.py:projeto_origem (fontes "importar"/"importado"). */
  async importarLevantamentoEGerarProjeto(
    projetoId: number,
    arquivo: File | null,
  ): Promise<ArquivoGeradoComRespostas> {
    const form = new FormData();
    if (arquivo) form.append('arquivo', arquivo);
    const res = await firstValueFrom(
      this.http.post(`${this.base}/projetos/${projetoId}/projeto/importar-levantamento`, form, {
        responseType: 'blob',
        observe: 'response',
      }),
    );
    return {
      blob: res.body as Blob,
      filename: nomeArquivo(res.headers.get('content-disposition'), 'projeto'),
      respostasImportadas: Number(res.headers.get('x-respostas-importadas') ?? 0),
    };
  }

  async cabecalho(projetoId: number): Promise<Cabecalho> {
    const res = await firstValueFrom(
      this.http.get<ApiEnvelope<Cabecalho>>(`${this.base}/projetos/${projetoId}/cabecalho`),
    );
    return res.data;
  }

  async avancar(projetoId: number): Promise<Projeto> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Projeto>>(`${this.base}/projetos/${projetoId}/avancar`, {}),
    );
    return res.data;
  }

  async adicionarNota(projetoId: number, nota: string): Promise<EventoProjeto> {
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<EventoProjeto>>(`${this.base}/projetos/${projetoId}/nota`, { nota }),
    );
    return res.data;
  }

  async anexar(projetoId: number, tipo: string, arquivo: File): Promise<Documento> {
    const form = new FormData();
    form.append('tipo', tipo);
    form.append('arquivo', arquivo);
    const res = await firstValueFrom(
      this.http.post<ApiEnvelope<Documento>>(`${this.base}/projetos/${projetoId}/anexar`, form),
    );
    return res.data;
  }

  async excluirDocumento(documentoId: number): Promise<void> {
    await firstValueFrom(this.http.delete<ApiEnvelope<null>>(`${this.base}/documentos/${documentoId}`));
  }
}
