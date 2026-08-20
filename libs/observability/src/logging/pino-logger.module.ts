import pino, { Logger as PinoLogger } from 'pino';

/**
 * Structured JSON logger used in place of Nest's default console Logger
 * in production (Nest's LoggerService interface is implemented so this
 * drops in via `app.useLogger(...)` in main.ts).
 *
 * Every log line includes `service`, and callers pass `correlationId` in
 * the bindings so logs can be correlated with traces and outbox rows.
 */
export function createPinoLogger(serviceName: string): PinoLogger {
  return pino({
    name: serviceName,
    level: process.env.LOG_LEVEL ?? 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['req.headers.authorization', 'payload.cardNumber', 'payload.cvv'],
  });
}

export class NestPinoAdapter {
  private readonly logger: PinoLogger;

  constructor(serviceName: string) {
    this.logger = createPinoLogger(serviceName);
  }

  log(message: string, context?: string) {
    this.logger.info({ context }, message);
  }
  error(message: string, trace?: string, context?: string) {
    this.logger.error({ context, trace }, message);
  }
  warn(message: string, context?: string) {
    this.logger.warn({ context }, message);
  }
  debug(message: string, context?: string) {
    this.logger.debug({ context }, message);
  }
  verbose(message: string, context?: string) {
    this.logger.trace({ context }, message);
  }
}
