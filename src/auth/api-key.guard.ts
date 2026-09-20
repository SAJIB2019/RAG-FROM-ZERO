import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_ROUTE } from '../common/decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
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

    const expectedApiKey = this.configService.get<string>('API_KEY');
    const nodeEnv = this.configService.getOrThrow<string>('NODE_ENV');

    if (!expectedApiKey && nodeEnv !== 'production') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedApiKey = request.header('x-api-key');

    if (!expectedApiKey || providedApiKey !== expectedApiKey) {
      throw new UnauthorizedException('Valid x-api-key header is required');
    }

    return true;
  }
}
