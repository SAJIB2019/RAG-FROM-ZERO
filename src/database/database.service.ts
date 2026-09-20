import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: configService.getOrThrow<string>('POSTGRES_HOST'),
      port: configService.getOrThrow<number>('POSTGRES_PORT'),
      database: configService.getOrThrow<string>('POSTGRES_DB'),
      user: configService.getOrThrow<string>('POSTGRES_USER'),
      password: configService.getOrThrow<string>('POSTGRES_PASSWORD'),
      ssl: configService.getOrThrow<boolean>('POSTGRES_SSL')
        ? { rejectUnauthorized: true }
        : undefined,
    });
  }

  // 2. Added "extends QueryResultRow" constraint to the generic type T
  query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
