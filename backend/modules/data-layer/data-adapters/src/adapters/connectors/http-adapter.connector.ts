import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { DataAdapterConnector, DataAdapterRunResult } from './connector.interface';

/**
 * Generic REST/OData pull — covers plain JSON APIs and SAP systems that
 * expose an OData service (the common case for SAP integration; a native
 * RFC connector would need SAP's licensed client libraries and is not
 * implemented here, see `connector-registry.ts`).
 */
@Injectable()
export class HttpAdapterConnector implements DataAdapterConnector {
  readonly type = 'http' as const;

  validateConfig(config: Record<string, unknown>): void {
    if (typeof config.url !== 'string' || !config.url) {
      throw new BadRequestException('HTTP-Adapter benötigt "connectionConfig.url".');
    }
  }

  async run(config: Record<string, unknown>): Promise<DataAdapterRunResult> {
    const url = config.url as string;
    const headers = (config.headers as Record<string, string> | undefined) ?? {};
    const response = await axios.get(url, { headers, timeout: 15_000 });
    const recordsProcessed = Array.isArray(response.data)
      ? response.data.length
      : Array.isArray(response.data?.value) // the common OData envelope shape
        ? response.data.value.length
        : 1;
    return { recordsProcessed };
  }
}
