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

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const body: ErrorBody = {
      error: {
        statusCode,
        message: typeof message === 'string' ? message : JSON.stringify(message),
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
}
