import { DynamicModule, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

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
    return {
      module: ElyvionLoggerModule,
      imports: [
        PinoLoggerModule.forRoot({
          pinoHttp: {
            level: options.level ?? 'info',
            base: { module: options.moduleName },
            genReqId: (req) =>
              (req.headers['x-correlation-id'] as string | undefined) ??
              crypto.randomUUID(),
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
