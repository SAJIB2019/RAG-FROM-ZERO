import { SpanStatusCode, trace } from '@opentelemetry/api';

export function traced<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  return trace
    .getTracer('rag-from-zero')
    .startActiveSpan(name, async (span) => {
      try {
        return await operation();
      } catch (error) {
        // Do not export document text, prompts, credentials, or provider error bodies.
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
}
