import {
  Injectable,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

@Injectable()
class TelemetryService implements OnModuleInit, OnApplicationShutdown {
  private sdk?: NodeSDK;
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (this.config.get<string>('OTEL_ENABLED') !== 'true') return;
    this.sdk = new NodeSDK({
      serviceName: this.config.getOrThrow<string>('OTEL_SERVICE_NAME'),
      traceExporter: new OTLPTraceExporter({
        url: this.config.getOrThrow<string>(
          'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
        ),
      }),
      metricReaders: [],
      logRecordProcessors: [],
    });
    this.sdk.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.sdk?.shutdown();
  }
}

@Module({ providers: [TelemetryService] })
export class TelemetryModule {}
