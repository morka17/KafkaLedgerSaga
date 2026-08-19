import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter. Normalizes every error - Nest HttpExceptions,
 * unexpected throws, even ones bubbling up from Kafka calls made inside a
 * controller - into one consistent JSON error shape, and never leaks stack
 * traces to the client in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? exception.getResponse()
      : 'Internal server error';

    const correlationId = (request.headers['x-correlation-id'] as string) ?? undefined;

    this.logger.error(
      `${request.method} ${request.url} -> ${status} [correlationId=${correlationId ?? 'n/a'}]`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      message,
    });
  }
}
