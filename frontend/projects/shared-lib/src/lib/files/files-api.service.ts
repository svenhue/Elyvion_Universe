import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiClientService } from '../api/api-client.service';
import { ELYVION_GATEWAY_URL } from '../api/gateway-url.token';

export interface StoredFileMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** Talks to the generic `files` backend module (GridFS-backed binary storage). */
@Injectable({ providedIn: 'root' })
export class FilesApiService {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = inject(ELYVION_GATEWAY_URL);
  private static readonly MODULE = 'files';

  upload(file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.api.post<StoredFileMeta>(FilesApiService.MODULE, '/files', formData).pipe(map((r) => r.data));
  }

  remove(id: string) {
    return this.api.delete<void>(FilesApiService.MODULE, `/files/${id}`);
  }

  /**
   * Fetches the file as a `Blob` through `HttpClient` (so the auth
   * interceptor attaches the Bearer token — a plain `<a href>` pointing at
   * `downloadUrl()` would not, since that's a raw browser navigation, not
   * an XHR/fetch call the interceptor can see). Hand the result to
   * `URL.createObjectURL()` to open or download it.
   */
  download(id: string) {
    return this.http.get(`${this.gatewayUrl}/api/${FilesApiService.MODULE}/files/${id}`, { responseType: 'blob' });
  }

  /** The raw endpoint `download()` fetches — exposed for reference/debugging, never as an `<a href>` (see `download()`'s doc comment). */
  downloadUrl(id: string): string {
    return `${this.gatewayUrl}/api/files/files/${id}`;
  }
}
