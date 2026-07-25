const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  ''
);

export function getApiBase(): string {
  return API_BASE;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body: unknown = null;
    let message = res.statusText || 'Request failed';
    let code: string | undefined;
    try {
      body = await res.json();
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.message === 'string') message = b.message;
        else if (typeof b.error === 'string') message = b.error;
        if (typeof b.code === 'string') code = b.code;
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status, code, body);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.blob()) as T;
}

export async function apiPostJson<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
