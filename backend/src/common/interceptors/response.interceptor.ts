import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Envelope<T> {
  success: true;
  data: T;
  message: string;
  pagination?: unknown;
  timestamp: string;
}

interface EnvelopeShaped {
  data: unknown;
  pagination?: unknown;
  message?: string;
}

function comoEnvelope(payload: unknown): EnvelopeShaped {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload;
  }
  return { data: payload };
}

/** Padroniza toda resposta 2xx no formato { success, data, message, timestamp }. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        const shaped = comoEnvelope(payload);
        return {
          success: true as const,
          data: shaped.data as T,
          message: shaped.message ?? 'Operação realizada com sucesso',
          ...(shaped.pagination ? { pagination: shaped.pagination } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
