const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : (payload?.message ?? `Request failed (${response.status})`);
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const apiResourceUrl = (value: string): string =>
  /^https?:\/\//i.test(value)
    ? value
    : new URL(value.replace(/^\//, ''), `${API_URL.replace(/\/$/, '')}/`).toString();
