import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const ttlMs =
      this.configService.getOrThrow<number>('THROTTLE_TTL_SECONDS') * 1000;
    const limit = this.configService.getOrThrow<number>('THROTTLE_LIMIT');
    const request = context.switchToHttp().getRequest<Request>();
    const key = createRateLimitKey(request);
    const now = Date.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + ttlMs,
      });

      this.cleanupExpiredEntries(now);

      return true;
    }

    current.count += 1;

    if (current.count > limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanupExpiredEntries(now: number): void {
    if (this.entries.size < 1000) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

function createRateLimitKey(request: Request): string {
  const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();
  const ip =
    forwardedFor || request.ip || request.socket.remoteAddress || 'unknown';
  const route = request.route?.path ?? request.path;

  return `${ip}:${request.method}:${route}`;
}
