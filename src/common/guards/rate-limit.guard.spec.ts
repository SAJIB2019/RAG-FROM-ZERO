import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { Request } from 'express';

import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  it('allows requests under the configured limit', () => {
    const guard = createGuard({ ttlSeconds: 60, limit: 2 });
    const context = createHttpContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects requests over the configured limit', () => {
    const guard = createGuard({ ttlSeconds: 60, limit: 1 });
    const context = createHttpContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('does not rate limit public routes', () => {
    const guard = createGuard({
      ttlSeconds: 60,
      limit: 1,
      isPublic: true,
    });
    const context = createHttpContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });
});

function createGuard(input: {
  ttlSeconds: number;
  limit: number;
  isPublic?: boolean;
}): RateLimitGuard {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'THROTTLE_TTL_SECONDS') {
        return input.ttlSeconds;
      }

      if (key === 'THROTTLE_LIMIT') {
        return input.limit;
      }

      throw new Error(`Unexpected config key ${key}`);
    }),
  } as unknown as ConfigService;

  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === IS_PUBLIC_ROUTE ? (input.isPublic ?? false) : undefined,
    ),
  } as unknown as Reflector;

  return new RateLimitGuard(configService, reflector);
}

function createHttpContext(): ExecutionContext {
  const request = {
    header: jest.fn((name: string) =>
      name.toLowerCase() === 'x-forwarded-for' ? undefined : undefined,
    ),
    ip: '127.0.0.1',
    method: 'POST',
    path: '/documents',
    route: {
      path: '/documents',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  } as unknown as Request;

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => request),
    })),
  } as unknown as ExecutionContext;
}
