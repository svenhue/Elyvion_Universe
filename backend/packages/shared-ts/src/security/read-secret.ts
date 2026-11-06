import { readFileSync } from 'node:fs';

export function readSecretValue(fileVariable: string, valueVariable?: string): string | undefined {
  const filePath = process.env[fileVariable];
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf8').trim() || undefined;
    } catch {
      throw new Error(`Could not read ${fileVariable}.`);
    }
  }
  return valueVariable ? process.env[valueVariable] : undefined;
}
