import { BadRequestException, Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { DataAdapterConnector, DataAdapterRunResult } from './connector.interface';

/**
 * Reads a local (or mounted-share) CSV file. Stands in for SFTP/file-drop
 * integrations — the config shape (`path`, optional `delimiter`) is the
 * same an SFTP-backed connector would need; swapping the file read for an
 * SFTP download is the only change required when that's actually needed.
 */
@Injectable()
export class FileAdapterConnector implements DataAdapterConnector {
  readonly type = 'file' as const;

  validateConfig(config: Record<string, unknown>): void {
    if (typeof config.path !== 'string' || !config.path) {
      throw new BadRequestException('File-Adapter benötigt "connectionConfig.path".');
    }
  }

  async run(config: Record<string, unknown>): Promise<DataAdapterRunResult> {
    const path = config.path as string;
    const delimiter = typeof config.delimiter === 'string' ? config.delimiter : ',';
    const content = await readFile(path, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    const dataLines = lines.length > 0 ? lines.length - 1 : 0; // minus header row
    void delimiter; // reserved for a future column-aware parse; row count doesn't need it yet
    return { recordsProcessed: Math.max(dataLines, 0) };
  }
}
