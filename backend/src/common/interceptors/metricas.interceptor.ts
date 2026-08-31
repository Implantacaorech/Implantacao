import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { metricasLatencia } from '../observabilidade/metricas-latencia';
import { requestIdAtual } from '../observabilidade/correlacao';

interface RequisicaoExpress {
  method?: string;
  route?: { path?: string };
  path?: string;
}
interface RespostaExpress {
  statusCode?: number;
}

/**
 * Interceptor global de OBSERVABILIDADE (eixo 9): para cada requisição, mede a duração e a
 * registra em `metricasLatencia` por TEMPLATE de rota, e — quando `MIGRACAO_LOG_JSON=1` — emite
 * uma linha de LOG ESTRUTURADO (JSON) com correlation-id, método, rota, status e duração,
 * pronta para uma ferramenta de log ingerir.
 *
 * O log JSON é OPT-IN de propósito: uma linha por requisição enche o log rápido; liga-se quando
 * se quer alimentar um coletor. A métrica de latência, essa, roda sempre (é barata e fica só em
 * memória).
 */
@Injectable()
export class MetricasInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Só HTTP: um contexto não-HTTP (se um dia houver) não tem req/route.
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<RequisicaoExpress>();
    const inicio = Date.now();
    // tap nos DOIS lados: uma rota que respondeu 500 também tem latência a medir.
    return next.handle().pipe(
      tap({
        next: () => this.registrar(context, req, inicio),
        error: () => this.registrar(context, req, inicio),
      }),
    );
  }

  private registrar(
    context: ExecutionContext,
    req: RequisicaoExpress,
    inicio: number,
  ): void {
    const ms = Date.now() - inicio;
    // Template da rota (`/projetos/:id`), não a URL concreta — evita explodir a cardinalidade.
    const template = req.route?.path ?? req.path ?? 'desconhecida';
    const metodo = req.method ?? 'GET';
    metricasLatencia.registrar(`${metodo} ${template}`, ms);

    if (process.env.MIGRACAO_LOG_JSON === '1') {
      const res = context.switchToHttp().getResponse<RespostaExpress>();
      process.stdout.write(
        JSON.stringify({
          ts: new Date().toISOString(),
          tipo: 'req',
          requestId: requestIdAtual() ?? null,
          metodo,
          rota: template,
          status: res.statusCode ?? 0,
          ms,
        }) + '\n',
      );
    }
  }
}
