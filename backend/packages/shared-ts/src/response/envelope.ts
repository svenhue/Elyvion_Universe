export interface ResponseEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function envelope<T>(data: T, meta?: Record<string, unknown>): ResponseEnvelope<T> {
  return meta ? { data, meta } : { data };
}
