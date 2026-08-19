import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Ensures every inbound request (HTTP or Kafka) carries a correlationId,
 * generating one if the caller didn't supply it, and stashes it on the
 * request/context so downstream services and Kafka publishers can
 * propagate the SAME id across the entire checkout saga. This is what
 * lets a single Jaeger trace span all six services for one order.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const type = context.getType();

    if (type === 'http') {
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();
      const correlationId = req.headers[CORRELATION_ID_HEADER] ?? randomUUID();
      req.correlationId = correlationId;
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    } else if (type === 'rpc') {
      const data = context.switchToRpc().getData();
      if (data && typeof data === 'object' && !data.correlationId) {
        data.correlationId = randomUUID();
      }
    }

    return next.handle();
  }
}
