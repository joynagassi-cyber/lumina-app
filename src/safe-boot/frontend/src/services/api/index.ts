/**
 * API client skeleton — REST client per PROTO-v1.
 * Each domain gets its own typed API client extending this base.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export abstract class APIClientBase {
  protected get baseUrl(): string {
    return BASE_URL;
  }

  protected async request<T>(
    _endpoint: string,
    _options?: RequestInit,
  ): Promise<T> {
    // TODO: Implement fetch wrapper with auth headers
    return {} as T;
  }
}
