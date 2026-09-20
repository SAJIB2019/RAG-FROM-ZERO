import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'rag-from-zero',
      environment: this.configService.getOrThrow<string>('NODE_ENV'),
    };
  }

  @Public()
  @Get('ready')
  async getReadiness() {
    const readiness = await this.healthService.checkReadiness();

    if (readiness.status !== 'ok') {
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
