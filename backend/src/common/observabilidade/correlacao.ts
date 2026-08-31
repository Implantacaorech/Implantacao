import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Correlation-id ponta a ponta (achado M9 da auditoria de 2026-08-12). Antes, não havia como
 * amarrar "o usuário viu um erro às 13:11" ao stack trace certo: cada log era uma linha solta,
 * sem id que atravessasse frontend → backend → docservice/IA.
 *
 * Agora cada requisição ganha um id (aceito do cabeçalho `x-request-id` de entrada, se são, ou
 * gerado). Ele fica num AsyncLocalStorage — acessível por qualquer código no ciclo da
 * requisição sem passar parâmetro por toda parte —, é ECOADO na resposta (o cliente pode
 * reportá-lo), entra no log de erro (HttpExceptionFilter) e é PROPAGADO às chamadas ao
 * docservice e à IA (mesmo cabeçalho).
 */
export const CABECALHO_REQUEST_ID = 'x-request-id';

interface ContextoRequest {
  requestId: string;
}

const als = new AsyncLocalStorage<ContextoRequest>();

/** Id de correlação da requisição atual — `''` fora de um request (ex.: robô/boot). */
export function requestIdAtual(): string {
  return als.getStore()?.requestId ?? '';
}

/** Um id de entrada só é aceito se for curto e são — evita header injection e valores enormes
 * de um cliente malicioso virarem o id de correlação. Caso contrário, geramos um. */
function idValido(bruto: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(bruto);
}

/** Middleware Express: resolve o id, ecoa na resposta e roda o resto do request no contexto. */
export function correlacaoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const entrada = String(req.headers[CABECALHO_REQUEST_ID] ?? '').trim();
  const requestId = idValido(entrada) ? entrada : randomUUID();
  res.setHeader(CABECALHO_REQUEST_ID, requestId);
  als.run({ requestId }, () => next());
}
