// ============================================================================
// API Client
// ============================================================================

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private accessToken: string | null = null;

  setToken(token: string | null) {
    this.accessToken = token;
  }

  getToken() {
    return this.accessToken;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      ...headers,
    };
    
    if (body !== undefined && body !== null && method !== 'GET' && method !== 'DELETE') {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body !== undefined && body !== null && method !== 'GET' && method !== 'DELETE') {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { code: 'NETWORK_ERROR', message: 'Network error occurred' },
      }));
      throw new ApiError(
        error.error?.code || 'UNKNOWN',
        error.error?.message || 'An error occurred',
        response.status,
        error.error?.details,
      );
    }

    return response.json();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async stream(
    endpoint: string,
    body: unknown,
    onEvent: (event: string, data: any) => void,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };

    if (this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { code: 'NETWORK_ERROR', message: 'Network error occurred' },
      }));
      throw new ApiError(
        error.error?.code || 'UNKNOWN',
        error.error?.message || 'An error occurred',
        response.status,
        error.error?.details,
      );
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        const lines = block.split('\n');
        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            currentData += line.replace('data:', '').trim();
          }
        }

        if (currentData) {
          try {
            const parsed = JSON.parse(currentData);
            onEvent(currentEvent, parsed);
          } catch {
            onEvent(currentEvent, currentData);
          }
        }
      }
    }
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
