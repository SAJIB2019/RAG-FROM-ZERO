import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { DatabaseService } from '../database/database.service';

type DependencyStatus = {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
};

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly databaseService: DatabaseService,
    configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: configService.getOrThrow<string>('REDIS_HOST'),
      port: configService.getOrThrow<number>('REDIS_PORT'),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      tls: configService.getOrThrow<boolean>('REDIS_TLS') ? {} : undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  async checkReadiness(): Promise<{
    status: 'ok' | 'error';
    checks: {
      postgres: DependencyStatus;
      redis: DependencyStatus;
    };
  }> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    return {
      status:
        postgres.status === 'up' && redis.status === 'up' ? 'ok' : 'error',
      checks: {
        postgres,
        redis,
      },
    };
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  private async checkPostgres(): Promise<DependencyStatus> {
    return this.measure(async () => {
      await this.databaseService.query('SELECT 1');
    });
  }

  private async checkRedis(): Promise<DependencyStatus> {
    return this.measure(async () => {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.ping();
    });
  }

  private async measure(
    operation: () => Promise<void>,
  ): Promise<DependencyStatus> {
    const startedAt = Date.now();

    try {
      await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timed out')), 2000);
        }),
      ]);

      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
