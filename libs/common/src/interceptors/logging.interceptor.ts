import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Structured request/response timing log for every HTTP and Kafka handler. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const type = context.getType();
    const label =
      type === 'http'
        ? `${context.switchToHttp().getRequest().method} ${context.switchToHttp().getRequest().url}`
        : `${context.getClass().name}.${context.getHandler().name}`;

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${label} +${Date.now() - start}ms`),
        error: (err) => this.logger.warn(`${label} failed after ${Date.now() - start}ms: ${err.message}`),
      }),
    );
  }
}
