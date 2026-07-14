import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiEnvelope } from '../dto/api-envelope';

export interface Envelope<T> {
  success: true;
  data: T;
  message: string;
  pagination?: unknown;
  timestamp: string;
}

/** Padroniza toda resposta 2xx no formato { success, data, message, timestamp }. Só desembrulha
 * quando o controller devolveu explicitamente um `ApiEnvelope` (ver
 * common/dto/api-response.ts) — nunca por duck-typing (`'data' in payload`), que colide com
 * qualquer entidade cujo próprio campo se chame `data` (ex.: AtividadeCronograma.data). */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        const envelope =
          payload instanceof ApiEnvelope ? payload : new ApiEnvelope(payload);
        return {
          success: true as const,
          data: envelope.data as T,
          message: envelope.message ?? 'Operação realizada com sucesso',
          ...(envelope.pagination ? { pagination: envelope.pagination } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
