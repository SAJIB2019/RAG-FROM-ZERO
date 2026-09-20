import {
  Controller,
  Get,
  Header,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(
    @Headers('x-metrics-api-key') metricsApiKey?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const expectedApiKey = this.configService.get<string>('METRICS_API_KEY');
    const bearerToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (
      expectedApiKey &&
      metricsApiKey !== expectedApiKey &&
      bearerToken !== expectedApiKey
    ) {
      throw new UnauthorizedException('Valid metrics API key required');
    }

    return this.metricsService.getMetrics();
  }
}
