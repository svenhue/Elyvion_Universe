export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  source: string;
  level: LogLevel;
  message: string;
  actionKey: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListLogsFilter {
  source?: string;
  level?: LogLevel;
  actionKey?: string;
  limit?: number;
}
