import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

/**
 * Boots OpenTelemetry BEFORE Nest itself (call from the very top of each
 * service's main.ts, prior to `NestFactory.create`). Auto-instruments
 * HTTP, Express, and — critically — KafkaJS, so every produce/consume call
 * becomes a span automatically, linked via the correlationId header set
 * in CorrelationIdInterceptor.
 *
 * Exports to an OTLP collector (Jaeger, Tempo, etc) configured via env.
 */
export function bootstrapTracing(serviceName: string): NodeSDK {
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Health-check spam pollutes traces; keep it out.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => req.url === '/health',
        },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });

  return sdk;
}
