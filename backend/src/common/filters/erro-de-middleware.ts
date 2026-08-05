import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('ErroDeMiddleware');

/** Mensagem em linguagem de negócio para os erros que o body-parser sabe produzir. */
function mensagem(tipo: string | undefined, status: number): string {
  if (status === 413) return 'O conteúdo enviado é grande demais.';
  if (tipo === 'entity.parse.failed') {
    return 'O conteúdo enviado não é um JSON válido.';
  }
  return 'Não foi possível ler o conteúdo enviado.';
}

/**
 * Erros levantados ANTES do roteador do Nest — body-parser (`entity.too.large`,
 * `entity.parse.failed`) e afins — não passam pelo `HttpExceptionFilter`, que só cobre o
 * ciclo de vida de uma rota. Sem este handler, o Express abandonava o roteamento e a
 * requisição terminava no 404 genérico do Nest: mandar um corpo grande demais respondia
 * **"Cannot POST /api/projetos/5/passos/5/concluir"**, dizendo que a rota não existe — o
 * pior diagnóstico possível para "seu conteúdo passou do tamanho" (achado de 2026-08-05).
 *
 * Registrado com `app.use()` DEPOIS da criação do app, para vir na cadeia após o body-parser
 * que o Nest instala. Mantém exatamente o mesmo envelope de erro do resto da API.
 */
export function erroDeMiddleware() {
  return (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (res.headersSent) return next(err);

    const bruto = (err ?? {}) as {
      status?: unknown;
      statusCode?: unknown;
      type?: unknown;
    };
    const cru = bruto.status ?? bruto.statusCode;
    const status =
      typeof cru === 'number' && cru >= 400 && cru < 600 ? cru : 500;
    const tipo = typeof bruto.type === 'string' ? bruto.type : undefined;

    if (status >= 500) {
      logger.error(err instanceof Error ? err.stack : String(err));
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      error: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
      message:
        status >= 500 ? 'Erro interno do servidor' : mensagem(tipo, status),
      details: [],
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  };
}
