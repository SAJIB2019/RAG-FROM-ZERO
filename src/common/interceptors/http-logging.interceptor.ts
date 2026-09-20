import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { MetricsService } from '../../metrics/metrics.service';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logRequest(request, response, startedAt);
      }),
      catchError((error: unknown) => {
        this.logRequest(request, response, startedAt, error);
        return throwError(() => error);
      }),
    );
  }

  private logRequest(
    request: Request,
    response: Response,
    startedAt: number,
    error?: unknown,
  ): void {
    const logPayload = {
      requestId: request.header(REQUEST_ID_HEADER),
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      userAgent: request.header('user-agent'),
      error: error instanceof Error ? error.message : undefined,
    };
    const route = request.route?.path
      ? `${request.baseUrl}${String(request.route.path)}`
      : request.path;

    this.metricsService.recordHttpRequest({
      method: request.method,
      route,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    });

    const message = JSON.stringify(logPayload);

    if (error || response.statusCode >= 500) {
      this.logger.error(message);
      return;
    }

    if (response.statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }
}
