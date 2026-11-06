import { z } from 'zod';

export const updateLlmConfigurationSchema = z.object({
  baseUrl: z.string().url().max(512),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2),
  numCtx: z.number().int().min(1024).max(131072),
});

export type UpdateLlmConfiguration = z.infer<typeof updateLlmConfigurationSchema>;

export interface PublicLlmConfiguration extends UpdateLlmConfiguration {
  scope: 'global';
  updatedAt?: Date;
}

export function validateBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Ollama URL must use HTTP(S) and must not contain credentials.');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Ollama URL must not contain query parameters or fragments.');
  }
  return parsed.toString().replace(/\/+$/, '');
}
