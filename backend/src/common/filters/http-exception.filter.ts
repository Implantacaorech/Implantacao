import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Padroniza toda resposta de erro no formato { success:false, statusCode, error, message, details }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const statusCode = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : null;
    const message =
      isHttp && typeof body === 'object' && body && 'message' in body
        ? (body as { message: string | string[] }).message
        : isHttp
          ? exception.message
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

    if (!isHttp) {
      // Erros não tratados nunca vazam detalhe interno para o cliente — só no log do servidor.
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
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
