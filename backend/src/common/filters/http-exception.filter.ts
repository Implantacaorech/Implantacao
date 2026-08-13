import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { contador5xx } from '../observabilidade/contador-5xx';

/** Status HTTP que um erro CRU de middleware carrega (body-parser/multer usam `status`;
 * alguns pacotes usam `statusCode`). `null` quando não é um desses.
 *
 * O `MulterError` de limite de tamanho (A4) é um caso à parte: NÃO traz `status`/`statusCode`,
 * só `name==='MulterError'` e `code`. Sem este mapeamento, um upload grande demais viraria 500
 * genérico em vez do 413 que diz ao usuário o que aconteceu. */
function statusDeErroCru(e: unknown): number | null {
  if (typeof e !== 'object' || e === null) return null;
  const bruto = e as {
    status?: unknown;
    statusCode?: unknown;
    name?: unknown;
    code?: unknown;
  };
  if (bruto.name === 'MulterError') {
    return bruto.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  }
  const valor = bruto.status ?? bruto.statusCode;
  return typeof valor === 'number' && valor >= 400 && valor < 600
    ? valor
    : null;
}

/** Padroniza toda resposta de erro no formato { success:false, statusCode, error, message, details }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    // Erro de MIDDLEWARE (body-parser, multer) não é HttpException, mas já traz o status
    // certo — `entity.too.large` chega como 413. Sem isto virava 500 (ou, quando escapava
    // do filtro, um "Cannot POST" 404 que dizia que a rota não existe: o pior diagnóstico
    // possível para "seu anexo é grande demais"). Achado de 2026-08-05.
    const statusDeMiddleware = statusDeErroCru(exception);
    const statusCode = isHttp
      ? exception.getStatus()
      : (statusDeMiddleware ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const body = isHttp ? exception.getResponse() : null;
    const message =
      isHttp && typeof body === 'object' && body && 'message' in body
        ? (body as { message: string | string[] }).message
        : isHttp
          ? exception.message
          : statusDeMiddleware === 413
            ? 'O conteúdo enviado é grande demais.'
            : statusDeMiddleware !== null
              ? 'Não foi possível ler o conteúdo enviado.'
              : 'Erro interno do servidor';
    const details =
      isHttp &&
      typeof body === 'object' &&
      body &&
      Array.isArray((body as { message?: unknown }).message)
        ? (body as { message: string[] }).message
        : [];
    // Sempre deriva o código do status HTTP — o "error" default do Nest (ex.: "Bad Request",
    // "Not Found") é texto em inglês pensado para debug, não o contrato estável da API.
    const errorCode = this.codigoParaStatus(statusCode);

    if (!isHttp && statusDeMiddleware === null) {
      // Erros não tratados nunca vazam detalhe interno para o cliente — só no log do servidor.
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // A12: alimenta o contador de 5xx que o /api/saude expõe e o digest diário reporta —
    // um erro interno deixa de ser invisível até o usuário reclamar.
    if (statusCode >= 500) {
      contador5xx.registrar(statusCode, request.url);
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error: errorCode,
      message: Array.isArray(message)
        ? 'Os dados informados são inválidos'
        : message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  // Compara com literais numéricos (não os membros do enum HttpStatus): `status` chega como
  // `number` puro de exception.getStatus(), e comparar number/enum diretamente é sinalizado
  // como inseguro pelo typescript-eslint (no-unsafe-enum-comparison).
  private codigoParaStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_ERROR';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}
