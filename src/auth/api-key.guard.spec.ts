import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  it('allows public routes without an API key', () => {
    const guard = createGuard({
      isPublic: true,
      apiKey: 'expected-key',
      nodeEnv: 'production',
    });

    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows valid API keys', () => {
    const guard = createGuard({
      isPublic: false,
      apiKey: 'expected-key',
      nodeEnv: 'production',
    });

    expect(guard.canActivate(createContext('expected-key'))).toBe(true);
  });

  it('rejects missing API keys in production', () => {
    const guard = createGuard({
      isPublic: false,
      apiKey: 'expected-key',
      nodeEnv: 'production',
    });

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});

function createGuard(input: {
  isPublic: boolean;
  apiKey: string;
  nodeEnv: string;
}): ApiKeyGuard {
  const configService = {
    get: (key: string) => (key === 'API_KEY' ? input.apiKey : undefined),
    getOrThrow: (key: string) => {
      if (key === 'NODE_ENV') {
        return input.nodeEnv;
      }

      throw new Error(`Unexpected config key ${key}`);
    },
  } as ConfigService;

  const reflector = {
    getAllAndOverride: () => input.isPublic,
  } as unknown as Reflector;

  return new ApiKeyGuard(configService, reflector);
}

function createContext(providedApiKey: string | undefined): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'x-api-key' ? providedApiKey : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}
