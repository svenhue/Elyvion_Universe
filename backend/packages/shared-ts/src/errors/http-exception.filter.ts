import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  error: {
    statusCode: number;
    message: string;
    path: string;
    correlationId?: string;
    timestamp: string;
  };
}

/**
 * Normalizes every thrown error (HttpException or not) into one JSON shape
 * so every module in the platform returns errors the same way.
 */
@Catch()
export class ElyvionExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorBody = {
      error: {
        statusCode,
        message: this.extractMessage(exception),
        path: request.url,
        correlationId: request.headers['x-correlation-id'] as string | undefined,
        timestamp: new Date().toISOString(),
      },
    };

    if (statusCode >= 500) {
      this.logger.error(exception);
    }

    response.status(statusCode).json(body);
  }

  private extractMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) {
      return 'Internal server error';
    }
    const response = exception.getResponse();
    if (typeof response === 'string') return response;

    if (response && typeof response === 'object' && 'message' in response) {
      const { message } = response as { message: unknown };
      if (typeof message === 'string') return message;
      // Nest's ValidationPipe shape is string[]; ours (raw ZodIssue[] passed
      // straight into an HttpException) is not — only join plain strings,
      // otherwise fall through to a full JSON dump so nothing collapses to
      // the useless "[object Object]" from Array.prototype.join.
      if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
        return (message as string[]).join(', ');
      }
    }

    return JSON.stringify(response);
  }
}
