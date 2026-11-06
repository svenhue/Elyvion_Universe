import { DynamicModule, Module } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { installHttpTrafficInstrumentation } from '../traffic/http-traffic-instrumentation';

export interface ElyvionLoggerOptions {
  moduleName: string;
  level?: string;
}

/**
 * Structured JSON logging (pino) with a `module` field on every line so
 * logs from Gateway/Auth/Registry/business modules can be correlated.
 */
@Module({})
export class ElyvionLoggerModule {
  static forRoot(options: ElyvionLoggerOptions): DynamicModule {
    installHttpTrafficInstrumentation(options.moduleName);
    return {
      module: ElyvionLoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level: options.level ?? 'info',
            base: { module: options.moduleName },
            genReqId: (req) => {
              const incomingId = req.headers['x-correlation-id'];
              return typeof incomingId === 'string' && incomingId.length <= 200 && /^[\w.-]+$/.test(incomingId)
                ? createHash('sha256').update(incomingId).digest('hex')
                : randomUUID();
            },
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
            },
            customProps: (req) => ({
              correlationId: req.id,
            }),
            transport:
              process.env.NODE_ENV !== 'production'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
          },
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
