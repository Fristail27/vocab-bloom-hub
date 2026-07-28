import cookies from 'js-cookie';
import { ErrorResT } from '../../../../../server/types';
import { ErrorCodes } from '../../../../../server/core/constants/error_codes';

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

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
    return cookies.get('bearer');
  }

  static async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T | ErrorResT> {
    const { query, headers = {}, body, ...fetchOptions } = options;
    try {
      const url = this.buildUrl(endpoint, query);

      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getToken()}`,
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
          Authorization: `Bearer ${await this.getToken()}`,
          ...headers,
        },
        ...(body && { body: JSON.stringify(body) }),
        ...fetchOptions,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);

        return {
          ...(err || {}),
          error: true,
        };
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
}
