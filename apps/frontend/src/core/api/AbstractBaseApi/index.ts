import { ErrorResT } from 'server/types';
import { ErrorCodes } from 'server/core/constants/error_codes';

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

export type DownloadedFileT = { blob: Blob; filename?: string };

export class AbstractBaseApi {
  static get baseURL(): string {
    return process.env.NEXT_PUBLIC_BASE_API_URL || '/api';
  }

  private static buildUrl(endpoint: string, query?: RequestOptions['query']) {
    const url = new URL(endpoint, this.baseURL);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  static async getToken(): Promise<string | undefined> {
    return undefined;
  }

  private static async buildAuthHeader(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  static async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T | ErrorResT> {
    const { query, headers = {}, body, ...fetchOptions } = options;
    try {
      const url = this.buildUrl(endpoint, query);

      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(await this.buildAuthHeader()),
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
        ...fetchOptions,
      });
      let data: T | null = null;
      try {
        data = await res.json();
      } catch {
        return { error: true, message: ErrorCodes.unparsed_data };
      }

      if (!res.ok) {
        return { ...(data as ErrorResT), error: true };
      }

      return data as T;
    } catch {
      return { error: true, message: ErrorCodes.failed_fetch };
    }
  }

  static get<T>(url: string, options?: Omit<RequestOptions, 'body' | 'method'>) {
    return this.request<T>(url, { ...(options || {}), method: 'GET' });
  }

  static post<T>(url: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>) {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  static put<T>(url: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>) {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  static patch<T>(url: string, body?: any, options?: Omit<RequestOptions, 'body' | 'method'>) {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  static delete<T>(url: string, options?: Omit<RequestOptions, 'body' | 'method'>) {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  static async stream(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ReadableStreamDefaultReader<Uint8Array> | ErrorResT> {
    const { query, headers = {}, body, ...fetchOptions } = options;

    try {
      const url = this.buildUrl(endpoint, query);

      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(await this.buildAuthHeader()),
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
        ...fetchOptions,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);

        return { ...(err || {}), error: true };
      }

      if (!res.body) {
        return {
          error: true,
          message: ErrorCodes.unparsed_data,
        };
      }

      return res.body.getReader();
    } catch {
      return {
        error: true,
        message: ErrorCodes.failed_fetch,
      };
    }
  }

  private static extractFilename(res: Response): string | undefined {
    const disposition = res.headers.get('Content-Disposition');
    if (!disposition) return undefined;

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    return plainMatch?.[1];
  }

  static async downloadFile(
    endpoint: string,
    options: RequestOptions = {},
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<DownloadedFileT | ErrorResT> {
    const { query, headers = {}, body, ...fetchOptions } = options;

    try {
      const url = this.buildUrl(endpoint, query);

      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          ...(await this.buildAuthHeader()),
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
        ...fetchOptions,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        return { ...(err || {}), error: true };
      }

      const filename = this.extractFilename(res);

      if (onProgress && res.body) {
        const total = Number(res.headers.get('Content-Length')) || 0;
        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let loaded = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          onProgress(loaded, total);
        }

        const blob = new Blob(chunks, { type: res.headers.get('Content-Type') ?? undefined });
        return { blob, filename };
      }

      const blob = await res.blob();

      return { blob, filename };
    } catch {
      return { error: true, message: ErrorCodes.failed_fetch };
    }
  }

  static saveBlobAsFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}
