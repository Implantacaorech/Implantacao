import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { propagarRequestId } from '../common/observabilidade/axios-correlacao';

export interface ArquivoGerado {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export type PreviewDocumento =
  { tipo: 'pdf'; buffer: Buffer } | { tipo: 'html'; html: string };

/** Cliente HTTP do serviço interno de geração de documentos (docservice/, FastAPI) — nunca
 * exposto publicamente, chamado só por este backend. Ver
 * docs/migracao/02-decisao-arquitetura.md, "Arquitetura híbrida". */
@Injectable()
export class GeracaoDocumentosService {
  constructor(private readonly http: HttpService) {
    propagarRequestId(http); // M9: correlation-id nas chamadas ao docservice.
  }

  /** Pré-visualização WYSIWYG (.docx -> PDF fiel via Word COM, com fallback em HTML; .xlsx
   * sempre em HTML) — equivalente a webapp/routes_fluxo.py:projeto_doc_ver. `caminho` já
   * deve ter sido validado pelo chamador (mesma confiança de `Documento.caminho` usada em
   * `baixar()`). */
  async preview(caminho: string): Promise<PreviewDocumento> {
    try {
      const res = await firstValueFrom(this.http.post('/preview', { caminho }));
      const data = res.data as {
        tipo: 'pdf' | 'html';
        conteudoBase64?: string;
        html?: string;
      };
      if (data.tipo === 'pdf') {
        return {
          tipo: 'pdf',
          buffer: Buffer.from(data.conteudoBase64 ?? '', 'base64'),
        };
      }
      return { tipo: 'html', html: data.html ?? '' };
    } catch (e) {
      const axiosErr = e as AxiosError<{ detail?: string }>;
      if (axiosErr.response?.status === 404) {
        throw new UnprocessableEntityException(
          'Arquivo não encontrado para pré-visualização.',
        );
      }
      throw new InternalServerErrorException(
        `Serviço de geração de documentos indisponível: ${axiosErr.message ?? 'erro desconhecido'}`,
      );
    }
  }

  async postParaArquivo(
    caminho: string,
    corpo: unknown,
  ): Promise<ArquivoGerado> {
    try {
      const res = await firstValueFrom(
        this.http.post(caminho, corpo, {
          responseType: 'arraybuffer',
          validateStatus: () => true,
        }),
      );
      if (res.status >= 400) {
        const detalhe = this.extrairDetalhe(res.data);
        if (res.status === 422) throw new UnprocessableEntityException(detalhe);
        throw new InternalServerErrorException(
          detalhe || 'Falha ao gerar o documento.',
        );
      }
      const contentDisposition = String(
        res.headers['content-disposition'] ?? '',
      );
      const nomeMatch = /filename="?([^";]+)"?/.exec(contentDisposition);
      return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        filename: nomeMatch?.[1] ?? 'documento',
        contentType: String(
          res.headers['content-type'] ?? 'application/octet-stream',
        ),
      };
    } catch (e) {
      if (
        e instanceof UnprocessableEntityException ||
        e instanceof InternalServerErrorException
      )
        throw e;
      const axiosErr = e as AxiosError;
      throw new InternalServerErrorException(
        `Serviço de geração de documentos indisponível: ${axiosErr.message ?? 'erro desconhecido'}`,
      );
    }
  }

  private extrairDetalhe(data: unknown): string {
    try {
      const texto = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : String(data);
      const json = JSON.parse(texto) as { detail?: string };
      return json.detail ?? texto;
    } catch {
      return 'Falha ao gerar o documento.';
    }
  }
}
