import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Thin axios wrapper so every module configures retries/timeouts/headers
 * the same way instead of each one instantiating axios differently.
 */
@Injectable()
export class ElyvionHttpClient {
  readonly instance: AxiosInstance;

  constructor(baseURL?: string) {
    this.instance = axios.create({
      baseURL,
      timeout: 5_000,
      headers: { 'content-type': 'application/json' },
    });
  }

  get<T>(url: string, params?: Record<string, unknown>) {
    return this.instance.get<T>(url, { params }).then((res) => res.data);
  }

  post<T>(url: string, body?: unknown) {
    return this.instance.post<T>(url, body).then((res) => res.data);
  }
}
