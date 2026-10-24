import { Injectable, NotImplementedException } from '@nestjs/common';
import { AdapterType } from '../schemas/data-adapter.schema';
import { DataAdapterConnector } from './connector.interface';
import { FileAdapterConnector } from './file-adapter.connector';
import { HttpAdapterConnector } from './http-adapter.connector';

/**
 * `jdbc` (generic SQL databases) and `sap` (native RFC, as opposed to the
 * OData-over-HTTP case the `http` connector already covers) are declared
 * in `ADAPTER_TYPES` and selectable in the UI so the target architecture
 * is visible end-to-end, but both need a licensed/native client library
 * this environment doesn't have — wiring a real implementation in means
 * adding one class here, nothing elsewhere in the module.
 */
@Injectable()
export class ConnectorRegistry {
  private readonly connectors: Map<AdapterType, DataAdapterConnector>;

  constructor(httpConnector: HttpAdapterConnector, fileConnector: FileAdapterConnector) {
    this.connectors = new Map<AdapterType, DataAdapterConnector>([
      [httpConnector.type, httpConnector],
      [fileConnector.type, fileConnector],
    ]);
  }

  get(type: AdapterType): DataAdapterConnector {
    const connector = this.connectors.get(type);
    if (!connector) {
      throw new NotImplementedException(`Adapter-Typ "${type}" ist noch nicht implementiert.`);
    }
    return connector;
  }
}
